var express = require('express');
var app = express();
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();
var io = require('socket.io');
var serv_io = io.listen(3400);
var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('fs');
var redis = require("redis");

var redis_options = {
    host: "chronusartcenter.org",
    port: "6379",
    db: 1
};

var client = redis.createClient(redis_options);

// if there is an error connecting to database
client.auth("cac_rc_2016", function(err) {
    if (err) {
        console.log("Error " + err);
    } else {
        console.log("connected to database")
    }
});

// serve files
app.use('/images', express.static(__dirname + '/public/images'));
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use('/js', express.static(__dirname + '/public/js'));

//render the form in the file index.html
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'), function(err) {
        if (err) {
            res.status(err.status).end();
        }
    });
});

//jury login
app.get('/login', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/login.html'), function(err) {
        if (err) {
            res.status(err.status).end();
        }
    });
});

//jury interface
app.post('/review', multipartMiddleware, function(req, res) {
    //console.log(req.body);
    // GET JUROR 1 FROM DB AND CHECK IT
    client.get("threeroomsjuror:1", function(err, data) {
        var obj = JSON.parse(data);
        console.log(obj);
        if (req.body.login == obj.name && req.body.pass == obj.password) {
            console.log("juror logged in!");
            res.sendFile(path.join(__dirname + '/public/review.html'), function(err) {
                if (err) {
                    res.status(err.status).end();
                }
            });
            client.get("users", function(err, data) {
                var count = 0;
                //iterate through each user in database
                for (var i = 0; i < data; i++) {
                    client.get("user:" + (i + 1), function(err, stored) {
                        //console.log(JSON.parse(stored));
                        setTimeout(function() {
                            serv_io.emit('review', stored);
                            count++;
                            //send signal when all data is loaded to close the socket
                            if (count == parseInt(data)) {
                                serv_io.emit('ended', true);
                                //console.log("All data sent!")
                            }
                        }, 2000);
                    });
                }
            });
        } else {
            console.log("WRONG!");
            res.send("wrong login credentials, please contact admin.");
        }
    });
});

// POST /submitted gets urlencoded bodies 
app.post('/submitted', multipartMiddleware, function(req, res) {
    // console.log(req.body, req.files);
    var obj = { data: null, files: null };
    obj.data = req.body;
    obj.files = req.files;
    console.log(req.files);

    client.incr('users', function(err, id) {
        client.set('user:' + id, JSON.stringify(obj));
    });

    mkdirp('./uploads/' + req.body.name, function(err) {
        if (err) {
            console.log(err);
        } else {
            fs.readFile(req.files.portfolio.path, function(err, data) {
                var newPath = __dirname + "/uploads/" + req.body.name + "/" + req.files.portfolio.originalFilename;
                fs.writeFile(newPath, data, function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            });
            fs.readFile(req.files.cv.path, function(err, data) {
                var newPath = __dirname + "/uploads/" + req.body.name + "/" + req.files.cv.originalFilename;
                fs.writeFile(newPath, data, function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            });
            res.send(
                "<style>" +
                "h1{" +
                "font-size: 55px;" +
                "}" +
                "h2{" +
                "font-size: 35px;" +
                "line-height: 5px;" +
                "}" +
                "</style>" +
                "<h1>Thank You!</h1>" +
                "<h2>Your submission is complete.</h2>" +
                "<h2>We will contact you soon.</h2>"
            );
        }
    });
});


// Create a page for each applicant
app.get('/applicant', function(req, res) {
    var applicantName = req.query["id"];
    client.get("users", function(err, data) {
        //iterate through each user in database
        for (var i = 0; i < data; i++) {
            client.get("user:" + (i + 1), function(err, obj) {
                var parsed = JSON.parse(obj);
                console.log(parsed.data.name)
                if (parsed.data.name != null) {
                    if (parsed.data.name == applicantName) {
                        res.sendFile(path.join(__dirname + '/public/applicant.html'), function(err) {
                            if (err) {
                                res.status(err.status).end();
                            } else {
                                setTimeout(function() {
                                    serv_io.emit('applicant', parsed);
                                }, 1000);
                            }
                        });
                    }
                }
            });
        }
    });
});

//Start Server
app.listen(3334, function() {
    console.log('listening on port 3334')
});
