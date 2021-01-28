const mysql = require('mysql2');

//connect to the database, create it if it doesn't already exist
let pool = null;
const conn = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	port: 3306,
	charset: "utf8mb4_general_ci"
});
conn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`, function(err, results) {
	if (err) console.log(err);

	pool = mysql.createPool({
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASS,
		database: process.env.DB_NAME,
		port: 3306,
		charset: "utf8mb4_general_ci"
	});

	//create all the cool things in our database
	queryDatabase(`CREATE TABLE IF NOT EXISTS stock (cik INT PRIMARY KEY NOT NULL, ticker TINYTEXT NOT NULL, name TINYTEXT NOT NULL);`)
	queryDatabase(`CREATE TABLE IF NOT EXISTS transaction (id INT PRIMARY KEY AUTO_INCREMENT, companycik INT NOT NULL, time DATETIME NOT NULL, price FLOAT NOT NULL, insiders TINYTEXT DEFAULT '[]', type TINYTEXT NOT NULL);`)
	.catch((err) => console.log(err));
});

//executes query and returns a promise
function queryDatabase(query) {
	return new Promise((resolve, reject) => {
		//query the database, reject if error, else resolve
		pool.query(query, function(err, results, fields) {
			if (err) return reject(err);

			//resolves as an object with results and fields properties
			resolve(results);
		});
	});
}

module.exports = {
	queryDatabase
}