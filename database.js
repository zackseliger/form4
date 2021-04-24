const { Pool, Client } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

// create tables if they don't exist already
pool.query(`CREATE TABLE IF NOT EXISTS issuers (
	id INT PRIMARY KEY,
	name TEXT NOT NULL,
	symbol TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS forms (
	id TEXT PRIMARY KEY,
	issuer_id INT REFERENCES issuers(id),
	filedDate TIMESTAMP NOT NULL,
	footnotes TEXT ARRAY,
	remarks TEXT
);

CREATE TABLE IF NOT EXISTS owners (
	id INT NOT NULL,
	form_id TEXT REFERENCES forms(id),
	isDirector BOOLEAN DEFAULT FALSE,
	isOfficer BOOLEAN DEFAULT FALSE,
	isTenPercentOwner BOOLEAN DEFAULT FALSE,
	isOther BOOLEAN DEFAULT FALSE,
	title TEXT,
	remarks TEXT,

	PRIMARY KEY(id, form_id)
);

CREATE TABLE IF NOT EXISTS transactions (
	id SERIAL PRIMARY KEY,
	form_id TEXT REFERENCES forms(id),
	derivative BOOLEAN NOT NULL,
	security TEXT NOT NULL,
	date DATE NOT NULL,
	code TEXT NOT NULL,
	acquired BOOLEAN NOT NULL,
	price NUMERIC,
	amount NUMERIC,
	direct BOOLEAN NOT NULL,

	-- for derivatives
	exercisePrice NUMERIC,
	exercisableDate DATE,
	expirationDate DATE
);`)
.catch(err=>console.error(err.stack));

function writeForm(form) {
	let curr = pool.query(`INSERT INTO issuers (id, name, symbol) VALUES ($1, $2, $3) ON CONFLICT(id) DO NOTHING`, [
		form.issuer.cik,
		form.issuer.name,
		form.issuer.symbol,
	])
	.then(res=>pool.query(`INSERT INTO forms (id, issuer_id, filedDate, footnotes, remarks) VALUES ($1, $2, $3, $4, $5);`, [
		form.id,
		form.issuer.cik,
		form.filedDate,
		form.footnotes,
		form.remarks,
	]));

	// owners
	for (let i = 0; i < form.owners.length; i++) {
		curr = curr.then(res=>pool.query(`INSERT INTO owners (id, form_id, isDirector, isOfficer, isTenPercentOwner, title, remarks)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, [
			form.owners[i].cik,
			form.id,
			form.owners[i].isDirector,
			form.owners[i].isOfficer,
			form.owners[i].isTenPercentOwner,
			form.owners[i].title,
			form.owners[i].remarks
		]));
	}

	// transactions
	for (let i = 0; i < form.nonDerivTransactions.length; i++) {
		curr = curr.then(res=>pool.query(`INSERT INTO transactions (form_id, derivative, security, date, code, acquired, price, amount, direct)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, [
			form.id,
			false,
			form.nonDerivTransactions[i].security,
			form.nonDerivTransactions[i].date,
			form.nonDerivTransactions[i].code,
			form.nonDerivTransactions[i].acquired,
			form.nonDerivTransactions[i].price,
			form.nonDerivTransactions[i].amount,
			form.nonDerivTransactions[i].direct
		]));
	}
	for (let i = 0; i < form.derivTransactions.length; i++) {
		curr = curr.then(res=>pool.query(`INSERT INTO transactions (form_id, derivative, security, date, code, acquired, price, amount, direct, exercisePrice, exercisableDate, expirationDate)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, [
			form.id,
			true,
			form.derivTransactions[i].security,
			form.derivTransactions[i].date,
			form.derivTransactions[i].code,
			form.derivTransactions[i].acquired,
			form.derivTransactions[i].price,
			form.derivTransactions[i].amount,
			form.derivTransactions[i].direct,
			form.derivTransactions[i].exercisePrice,
			form.derivTransactions[i].exercisableDate,
			form.derivTransactions[i].expirationDate
		]));
	}

	return curr.catch(err=>console.error(err.stack));
}

function formExists(id, callback) {
	pool.query(`SELECT id FROM forms WHERE id = $1`, [id], function(err, res) {
		if (err) return callback(err);

		callback(null, res.rows.length > 0);
	});
}

module.exports = {
	writeForm,
	formExists
};