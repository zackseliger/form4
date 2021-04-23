const express = require('express');
const session = require('express-session');
require('dotenv').config();

// set up app
const app = express();
app.set('view engine', 'ejs');
app.set('views', __dirname + '/../../views');
app.use(express.static('public'));

// have server listen
app.listen(process.env.PORT || 80, function(err) {
	if (err) return console.log(err);

	console.log("app started on port " + (process.env.PORT || 80));
});