/* Imports */

var Engine = require('tingodb')({});

var dbState;
var express = require('express');
var jsonfile = require('jsonfile');
var tingo = require('./tingo');
var exec = require('child_process').exec;
var path = require('path');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var fs = require('fs');
var app = express();
var events = require('events');
var cors = require('cors');
//var backupControl = require('./script/backup_ctrl')
const cst = require('./constants')
app.options('*', cors()) //needed to allow communication between different localhost (here 3000 and 8080)

var db = new Engine.Db(cst.DB_DIR, {});
var DbApi =  tingo; 

// Default User implemented for history
var User="random_user";

//
// Init the database with options

//boolean default values

var b_mongo_t = false; //allow to activate mongo_test mode when true
var b_history = false; //allow to activate history when true


/* This block manage options developped in the command line part of the project */
/*
if(process.argv[3]==="--mongo"){
  DbApi = mongo;
  console.log("using mongodb")
}
else if (process.argv[3]==="--tingo"){
  DbApi = tingo;
  console.log("using tingodb")
}
*/

let arg = process.argv;

process.argv.forEach(function(val,index,array){
  if(val === "--history") {
    b_history = true;
  }
  if (val === "-init"){
    DbApi.insertData(db, __dirname+'/'+arg[arg.indexOf("-init")+1]);
    if(b_history ===true){
      write_history("init",__dirname+'/'+arg[arg.indexOf("-init")+1])
    } 
  }

  else if(val === "-reinit"){
    DbApi.deleteData(db).then((msg)=>{
      console.log(msg.msg)
      DbApi.insertData(db, __dirname+'/'+array[index+1]).then((data)=>{
        console.log("status : "+data)
        
      }); //the emitter is used to force the execution's order
      
      if(b_history ===true){
        write_history("reinit",__dirname+'/'+arg[arg.indexOf("-reinit")+1])
      } 
    })
  }

  if (val === "-backup"){
    let backup_hour = Number(arg[arg.indexOf("-backup")+1]);
    let backup_minutes = Number(arg[arg.indexOf("-backup")+2]);
    //backup_hour = Number(backup_hour);
    //backup_minutes = Number(backup_minutes);
    if (Number.isInteger(backup_hour) && Number.isInteger(backup_minutes)){
      if(backup_hour <= 23 && backup_hour >= 0 && backup_minutes <=59 && backup_minutes >= 0 ){
        let backup_time = {"hours":backup_hour,"minutes":backup_minutes}; //the data are send to mongo.js in this format
        //console.log(backup_time)

        backupControl.extractdb(db)

        //backupControl.startUp
        //backupModule.control_backup(false)
        //DbApi.runBackup(backup_time);
      }
      else{
        throw("the time you chose for the backup is incorrect");
      } 
    }
    else{
      throw("the time you chose for the backup is incorrect");
    }
  }

})


// usefull functions

/* This function was made to write the history of the project
*  It's purpose was to see the modifications of the database 
*  in a csv file (separator ";" ) that will be accessible on a 
*  web page in the future.
*/ 

// This function allow to write history

var write_history = function(state,data){
  let today = new Date();
  let dd = today.getDate();
  let mm = today.getMonth()+1; //January is 0!
  let hh = today.getHours()
  let yyyy = today.getFullYear();

  if(dd<10) {
    dd = '0'+dd
  } 

  if(mm<10) {
    mm = '0'+mm
  } 

  fs.appendFileSync("./history.csv", today + ";" + state + ";" + data + ";"+ User + "\n") 

}


//HTML routes

app.get('/', function(req, res) {
  res.send("Welcome to deterDB")
})

app.get('/getKeys',function(req, res,next){
  DbApi.getallkeys(db).then(function(items){
    res.send(items);
  })
})

//cors () needed to allow communication between different localhost
app.get('/getallid',cors(),function(req,res,next){
    DbApi.Find_all_id(db).then(function(items) {
      res.send({"data":items});
    }, function(err) {
      console.error('The promise was rejected', err, err.stack);
    });
})

app.get('/getOne/:deter',cors(),function(req,res,next){
    DbApi.Find_a_Det(db,req.params.deter).then(function(items) {
      let test = items;
      if (test.hasOwnProperty("error"))
        res.send(test)
      else
        res.send({"data":test});
    },function(err) {
      console.error('The promise was rejected', err, err.stack);
    });
})

app.get('/pdb/:file', function (req, res, next) {
  //console.log('Detergent PDB file request:', req.params.file);
  next();
}, function (req, res, next) {
  res.sendFile(cst.PDB_DIR + "/" +req.params.file);
});

//Route to get data by category to display in detbelt client
app.get("/sortByCategory", (req, res) => {
  DbApi.sortByCategory(db).then(data => res.send({"data": data}))
    .catch(err => {
      console.error(`Error while sortByCategory : ${err}`)
      res.send({"error": err.message})
    })
})

app.get("/dbSnapshot", (req, res) => {
  DbApi.getSnapshot(db).then(data => res.send(data))
    .catch(err => {
      console.error(`Error while sortByCategory : ${err}`)
      res.send({"error": err.message})
    })
})



app.listen(3709, function () {
  console.log('deterDB server listening on port 3709!')
})
