var jsonfile = require('jsonfile');
var path = require('path');
var fs = require('fs');
var EventEmitter = require('events');
var backupModule = require('./mongodb_backup.js');
const cst = require('./constants')


//Function to run the backup
var runBackup = function(time){
	backupModule.backup(time);
}

//Function to check conditions for insert detergents 
/* Caracteristics category, _id, volume, color are needed (not null) :
* category : string
* _id : string
* volume : number
* color : object
*/

var checkConditionsInsert = function(detergent){
	let check = true;
	if(typeof(detergent.category) !== 'string' || detergent.category === 'null'){
		check = 'The detergent category must be filled with string type';
		return check;
	}
	if (typeof(detergent._id) !== 'string' || detergent.name === 'null'){
		check = 'The detergent name must be filled with string type';
		return check;
	}
	if (typeof(detergent.volume) !== 'number' || detergent.volume === 'null'){
		check = 'The detergent volume must be filled with number type';
		return check;
	}
	if (typeof(detergent.color) !== 'object' || detergent.color.length !== 3) {
		check = 'The detergent color must be a list of 3 values';
		return check;
	}
	return check; //Return true if conditions are met
}

//Function to normalize colors between 0 and 255
var modifyColor = function(detergent){
	if (detergent[0] >= 0 && detergent[1] >= 0 && detergent[2] >= 0
	&& detergent[0] <= 1 && detergent[1] <= 1 && detergent[2] <= 1){
		detergent[0] = detergent[0]*255;
		detergent[1] = detergent[1]*255;
		detergent[2] = detergent[2]*255;
	}
}

//Function to modify 'detBelt' format in 'mongo' format
/* Input : JSON in 'detBelt' format
* Output : Json in 'mongo' format (database format )
*/
var Json_detBelt_mongo = function(path) {
	let dict = jsonfile.readFileSync(path,'utf8'); //contain the JSON
	let write = []; 

	let values = Object.keys(dict.data).map(function(key) { 
    	return dict.data[key];
	});
	
	for(let i=0; i<values.length; i++){ //for each class of detergent (eg: maltoside)
	
		for(let j=0; j<values[i].length; j++){ //for each detergent
			let det = values[i][j];
			det.category = Object.keys(dict.data)[i];
			if(det['name']){
				det['_id'] = det['name']; //Rename key 'name' to '_id'
			}
			delete det['name'];
			modifyColor(det.color); //Normalization of colors
			write.push(det);
		}
	}
	dict.data = write; //replace "data" values
	
	return dict;
}

//Function to insert JSON file in database
/* path : path of the JSON file 
*/

var insertData = function(db, path) {
	return new Promise((resolve,reject)=>{
		let dict = Json_detBelt_mongo(path);
		for(let i=0; i<dict.data.length; i++){ //for each detergent
			let detergent = dict.data[i];
			let check = checkConditionsInsert(detergent);
			if(check === true){ //if conditions are check
				db.collection(cst.DB_JSON_NAME).insert(detergent, function(err,result){
					if(err){
						if (err.code === 11000) { //if _id is not unique
							let nameDet = err.errmsg.split('"')[1]; //id of the detergent error
							console.log(nameDet, ': The detergent name must be unique');
						}
						else{
							throw err;
						}
					}
				});
			}
			else{
				console.log(detergent._id, ' : ', checkConditionsInsert(detergent));
			}
		}
		console.log('Insertion of detergents is finished !')
		resolve('finished')
		backupModule.control_backup(true); //variable backup = true, the database has been modified

	})

	
}

var Find_a_Det = function(db,id){
	return new Promise((resolve,reject)=>{
		let collection = db.collection(cst.DB_JSON_NAME);
 		collection.find({"_id":id}).toArray(function(error,content){
			let det;	
			if(content.length === 0){
				det = {"error":"this detergent is probably not in our database"};	
			}else{
				det = content;
			};
			resolve(det)
		});
	})
}

var Find_all_id = function(db){
	return new Promise((resolve,reject)=>{
		let collection = db.collection(cst.DB_JSON_NAME);
		collection.find({},{"id":1}).toArray(function(error,content){
			let l_id = [];
			content.forEach(function(doc){
				l_id.push(doc["_id"]);
			})
 			resolve(l_id);
		});
	})
}

const sortByCategory = function(db){
	return new Promise((resolve,reject)=>{ 
		const collection = db.collection(cst.DB_JSON_NAME);
		collection.find({}).toArray((err, content) => {
			if(err) reject(err); 
			try{
				let storedDict = {}
				content.forEach((doc) => {
					if(doc.category in storedDict){
						storedDict[doc.category].push(doc._id)
					}
					else{
						storedDict[doc.category] = [doc._id]
					}
				})
			resolve(storedDict)
			}
			catch(error) {reject(error)}
			
			
		})
		
	})
}

const getSnapshot = function(db){
	return new Promise((resolve,reject)=>{ 
		const collection = db.collection(cst.DB_JSON_NAME);
		collection.find({}).toArray((err, content) => {
			if(err) reject(err); 
			try{
				let storedDict = {"title" : "Detergent database snapshot", 
					"date" : new Date(),
					"author" : "tingo_snapshot",
					"data" : {}
				}
				content.forEach((doc) => {
					const slim_infos = {"name": doc._id, "vol": doc.volume, "color": doc.color}
					if(doc.category in storedDict["data"]){
						storedDict["data"][doc.category].push(slim_infos)
					}
					else{
						storedDict["data"][doc.category] = [slim_infos]
					}
				})
			resolve(storedDict)
			}
			catch(error) {reject(error)}
			
			
		})
		
	})
}

/////////////////////////////////////////////////
//Function to return all keys of the database

var getallkeys = function(db){
	return new Promise((resolve, reject)=> {
		let allKeys = {};
		let collection = db.collection(cst.DB_JSON_NAME);
		collection.find({}).toArray(function(error,content){
			content.forEach(function(doc){
				Object.keys(doc).forEach(function(key){allKeys[key] = '1'})
			})
			let l_keys = Object.keys(allKeys)
			let ordered_l_keys = []
			let idControl = false;
			for(let i of l_keys){
				if(i !== "_id" ){
					ordered_l_keys.push(i)
				}
				else{
					idControl = true;
				}
			}
			if(idControl){
				ordered_l_keys.unshift("_id")
			}
			resolve(ordered_l_keys);
		})
	})
}


var deleteData = function(db){
	return new Promise((resolve,reject)=>{
		db.collection(cst.DB_JSON_NAME).drop(function(err,result){ //deletion of the database
		if(err){
	    	reject({"status":'Error', "data": 'Error in the deletion of ' + idDet});
		}
		else{
			let msg = 'The database has been deleted'
			//console.log('The database has been deleted');
			backupModule.control_backup(true);
			resolve({"msg":msg, "result":result});
		}
		});
	})
}


module.exports = {
  	getallkeys: getallkeys,
  	insertData: insertData,
  	deleteData: deleteData,
  	Find_a_Det : Find_a_Det,
	Find_all_id : Find_all_id, 
	sortByCategory : sortByCategory,
	getSnapshot : getSnapshot
};
