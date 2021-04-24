const express = require('express');
const session = require('express-session');
require('dotenv').config();

// set up app
const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', function(req, res) {
	res.render('homepage');
});

// have server listen
app.listen(process.env.PORT || 80, function(err) {
	if (err) return console.log(err);

	console.log("app started on port " + (process.env.PORT || 80));
});