const fetch = require('node-fetch');
const { DOMParser } = require('xmldom');
const fs = require('fs');

class Owner {
	constructor(cik, name) {
		this.cik = cik;
		this.name = name;

		this.isDirector = false;
		this.isOfficer = false;
		this.isTenPercentOwner = false;
		this.isOther = false;

		this.title = "";
		this.remarks = "";
	}
}

class Issuer {
	constructor(cik, name, symbol) {
		this.cik = cik;
		this.name = name;
		this.symbol = symbol;
	}
}

class Transaction {
	constructor(owners, issuer) {
		this.owners = owners;
		this.issuer = issuer;

		this.security = null;
		this.derivative = null;
		this.date = null;
		this.code = null;
		this.acquired = null;
		this.price = null;
		this.amount = null;
		this.direct = null;

		// for derivatives
		this.exercisePrice = null;
		this.exercisableDate = null;
		this.expirationDate = null;
	}
}

class Form {
	constructor(issuer, owners, derivTransactions, nonDerivTransactions) {
		this.issuer = issuer;
		this.owners = owners;
		this.derivTransactions = derivTransactions;
		this.nonDerivTransactions = nonDerivTransactions;

		this.filedDate = null;
		this.footnotes = [];
		this.remarks = null;
		this.id = null;
	}
}

let baseDir = 'https://www.sec.gov/Archives/';
let baseDailyDir = baseDir+'edgar/daily-index/'

// gets form 4s from idx file. Returns array in format:
// form#, company name, CIK, date filed, file name
function parseIdx(text) {
	let results = [];

	// split idx file by line and look for form 4's
	let lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		if (lines[i][0] == '4' && lines[i][1] == ' ') {
			// parse line and remove gaps in array
			let tokens = lines[i].split('  ');
			for (let j = 0; j < tokens.length; j++) {
				if (tokens[j].trim() == '') {
					tokens.splice(j,1);
					j--;
				}
				else {
					tokens[j] = tokens[j].trim();
				}
			}

			results.push(tokens);
		}
	}

	return results;
}

function valueOr(node, val) {
	if (node === undefined) return val;
	let tryValue = node.getElementsByTagName("value");
	if (tryValue.length < 1) return val;

	return tryValue[0].textContent;
}

// parse form 4 transaction from text
function parseForm(text) {
	let xmlText = text.substring(text.indexOf("<XML>"), text.indexOf("</XML>")+6)
	let xmlDoc = (new DOMParser()).parseFromString(xmlText, "text/xml");

	{
		let issuerCik = parseInt(xmlDoc.getElementsByTagName("issuer")[0].getElementsByTagName("issuerCik")[0].textContent);
		let id = text.substring(text.indexOf("<SEC-DOCUMENT>")+14);
		id = id.substring(0, id.indexOf(".txt"));
		console.log(issuerCik+"/"+id);
	}

	let issuerNode = xmlDoc.getElementsByTagName("issuer")[0];
	let nonDerivNodes = xmlDoc.getElementsByTagName("nonDerivativeTransaction");
	let derivNodes = xmlDoc.getElementsByTagName("derivativeTransaction");
	let ownersNodes = xmlDoc.getElementsByTagName("reportingOwner");

	// get issuer
	let issuerCik = parseInt(issuerNode.getElementsByTagName("issuerCik")[0].textContent);
	let issuerName = issuerNode.getElementsByTagName("issuerName")[0].textContent;
	let issuerTradingSymbol = issuerNode.getElementsByTagName("issuerTradingSymbol")[0].textContent;
	let issuer = new Issuer(issuerCik, issuerName, issuerTradingSymbol);

	// get owners
	let owners = [];
	for (let i = 0; i < ownersNodes.length; i++) {
		let ownerCik = parseInt(ownersNodes[i].getElementsByTagName("reportingOwnerId")[0].getElementsByTagName("rptOwnerCik")[0].textContent);
		let ownerName = ownersNodes[i].getElementsByTagName("reportingOwnerId")[0].getElementsByTagName("rptOwnerName")[0].textContent;
		let owner = new Owner(ownerCik, ownerName);

		let relationshipNode = ownersNodes[i].getElementsByTagName("reportingOwnerRelationship")[0];
		owner.isDirector = relationshipNode.getElementsByTagName("isDirector")[0].textContent === "1";
		owner.isOfficer = relationshipNode.getElementsByTagName("isOfficer")[0].textContent === "1";
		owner.isTenPercentOwner = relationshipNode.getElementsByTagName("isTenPercentOwner")[0].textContent === "1";
		owner.isOther = relationshipNode.getElementsByTagName("isOther")[0].textContent === "1";

		if (owner.isOfficer) {
			owner.title = relationshipNode.getElementsByTagName("officerTitle")[0].textContent;
		}
		if (owner.isOther) {
			owner.remarks = relationshipNode.getElementsByTagName("otherText")[0].textContent;
		}

		owners.push(owner);
	}

	// get non-derivative transactions
	nonDerivTransactions = [];
	for (let i = 0; i < nonDerivNodes.length; i++) {
		let transaction = new Transaction(owners, issuer);

		transaction.derivative = false;
		transaction.security = nonDerivNodes[i].getElementsByTagName("securityTitle")[0].getElementsByTagName("value")[0].textContent;
		transaction.date = new Date(nonDerivNodes[i].getElementsByTagName("transactionDate")[0].getElementsByTagName("value")[0].textContent);
		transaction.code = nonDerivNodes[i].getElementsByTagName("transactionCoding")[0].getElementsByTagName("transactionCode")[0].textContent;
		transaction.acquired = nonDerivNodes[i].getElementsByTagName("transactionAcquiredDisposedCode")[0].getElementsByTagName("value")[0].textContent === "A";
		transaction.price = parseFloat(nonDerivNodes[i].getElementsByTagName("transactionPricePerShare")[0].getElementsByTagName("value")[0].textContent);
		transaction.amount = parseInt(nonDerivNodes[i].getElementsByTagName("transactionShares")[0].getElementsByTagName("value")[0].textContent);
		transaction.direct = nonDerivNodes[i].getElementsByTagName("directOrIndirectOwnership")[0].getElementsByTagName("value")[0].textContent === "D";

		nonDerivTransactions.push(transaction);
	}

	// get derivative transactions
	derivTransactions = [];
	for (let i = 0; i < derivNodes.length; i++) {
		let transaction = new Transaction(owners, issuer);

		transaction.derivative = true;
		transaction.security = derivNodes[i].getElementsByTagName("securityTitle")[0].getElementsByTagName("value")[0].textContent;
		transaction.date = new Date(derivNodes[i].getElementsByTagName("transactionDate")[0].getElementsByTagName("value")[0].textContent);
		transaction.code = derivNodes[i].getElementsByTagName("transactionCoding")[0].getElementsByTagName("transactionCode")[0].textContent;
		transaction.acquired = derivNodes[i].getElementsByTagName("transactionAcquiredDisposedCode")[0].getElementsByTagName("value")[0].textContent === "A";
		transaction.price = parseFloat(derivNodes[i].getElementsByTagName("transactionPricePerShare")[0].getElementsByTagName("value")[0].textContent);
		transactionAmount = parseInt(valueOr(derivNodes[i].getElementsByTagName("transactionShares")[0], null));
		transaction.direct = derivNodes[i].getElementsByTagName("directOrIndirectOwnership")[0].getElementsByTagName("value")[0].textContent === "D";

		// just for derivative transactions
		// transaction.exercisePrice = parseFloat(derivNodes[i].getElementsByTagName("conversionOrExercisePrice")[0].getElementsByTagName("value")[0].textContent);
		transaction.exercisePrice = parseFloat(valueOr(derivNodes[i].getElementsByTagName("conversionOrExercisePrice")[0], null));
		if (derivNodes[i].getElementsByTagName("exerciseDate")[0].getElementsByTagName("value").length > 0) {
			transaction.exercisableDate = new Date(derivNodes[i].getElementsByTagName("exerciseDate")[0].getElementsByTagName("value")[0].textContent);
		}
		if (derivNodes[i].getElementsByTagName("expirationDate")[0].getElementsByTagName("value").length > 0) {
			transaction.expirationDate = new Date(derivNodes[i].getElementsByTagName("expirationDate")[0].getElementsByTagName("value")[0].textContent);
		}

		derivTransactions.push(transaction);
	}

	// create form
	let form = new Form(issuer, owners, derivTransactions, nonDerivTransactions);
	// get date/time filed
	let dateText = text.substring(text.indexOf("<ACCEPTANCE-DATETIME>")+21);
	dateText = dateText.substring(0, dateText.indexOf("\n"));
	let year = dateText.substring(0,4);
	let month = dateText.substring(4,6);
	let day = dateText.substring(6,8);
	let hour = dateText.substring(8,10);
	let minute = dateText.substring(10,12);
	form.filedDate = new Date(`${year}-${month}-${day} ${hour}:${minute}`);
	// get form id
	let id = text.substring(text.indexOf("<SEC-DOCUMENT>")+14);
	id = id.substring(0, id.indexOf(".txt"));
	form.id = id;
	// footnotes
	let footnotes = xmlDoc.getElementsByTagName("footnotes");
	if (footnotes.length > 0) {
		footnotes = footnotes[0].getElementsByTagName("footnote");
		for (let i = 0; i < footnotes.length; i++) {
			form.footnotes.push(footnotes[i].textContent);
		}
	}
	// remarks
	let remarks = xmlDoc.getElementsByTagName("remarks");
	if (remarks.length > 0) {
		form.remarks = remarks[0].textContent;
	}

	return form;
}

function writeFormToFile(form, path) {
	fs.open(path+"/"+form.id+".txt", 'w', function(err, file) {
		if (err) return console.log(err);
		let data = "";

		data += "-----ISSUER-----\n";
		data += "CIK:\t\t"+form.issuer.cik+"\n";
		data += "name:\t\t"+form.issuer.name+"\n";
		data += "ticker:\t\t"+form.issuer.symbol+"\n\n"

		data += "-----OWNERS-----\n";
		for (let i = 0; i < form.owners.length; i++) {
			data += form.owners[i].name+": ";
			if (form.owners[i].isDirector) data += "director, ";
			if (form.owners[i].isOfficer) data += form.owners[i].title+", ";
			if (form.owners[i].isTenPercentOwner) data += "10% owner, ";
			if (form.owners[i].isOther) data += form.owners[i].remarks+", ";
			data = data.substring(0, data.length-2);
			data += "\n";
		}
		data += "\n";

		if (form.nonDerivTransactions.length > 0) {
			data += "-----NON-DERIVATIVE TRANSACTIONS-----\n";
			for (let i = 0; i < form.nonDerivTransactions.length; i++) {
				data += `${form.nonDerivTransactions[i].acquired === true ? "BOUGHT" : "SOLD"} ${form.nonDerivTransactions[i].security}, ${form.nonDerivTransactions[i].amount} @ $${form.nonDerivTransactions[i].price} on ${form.nonDerivTransactions[i].date}\n`;
			}
			data += "\n";
		}

		if (form.derivTransactions.length > 0) {
			data += "-----DERIVATIVE TRANSACTIONS-----\n";
			for (let i = 0; i < form.derivTransactions.length; i++) {
				data += `${form.derivTransactions[i].acquired === true ? "BOUGHT" : "SOLD"} ${form.derivTransactions[i].security}, ${form.derivTransactions[i].amount} @ $${form.derivTransactions[i].price} on ${form.derivTransactions[i].date}\n`;
				data += `exercise for $${form.derivTransactions[i].exercisePrice} before ${form.derivTransactions[i].expirationDate} but after ${form.derivTransactions[i].exercisableDate}\n`;
			}
			data += "\n";
		}

		data += "filed on "+form.filedDate+"\n";

		if (form.footnotes.length > 0) {
			data += "\nFOOTNOTES:\n";
			for (let i = 0; i < form.footnotes.length; i++) {
				data += form.footnotes[i]+"\n";
			}
		}

		if (form.remarks !== null) {
			data += "\nREMARKS:\n"+form.remarks;
		}

		data = Buffer.from(data);
		fs.write(file, data, function(err) {
			if (err) console.log(err);
		})
	});
}

function getF4Forms() {
	// make queues and methods that poll from them
	let toProcess = [];
	let toFetch = [];
	let doneFetching = false;
	let processForms = function() {
		if (toProcess.length === 0 && doneFetching === true) {
			console.log("done processing");
			return clearInterval(this);
		}
		if (toProcess.length < 1) return;

		textData = toProcess.pop();
		let form = parseForm(textData);
		writeFormToFile(form, "public");
	}
	setInterval(processForms, 150);
	let fetchForms = function() {
		if (toFetch.length === 0) {
			doneFetching = true;
			clearInterval(this);
			console.log("done fetching");
			return;
		}

		let url = toFetch.pop();
		fetch(url, {headers: {"User-Agent": "F4 Analytics"}})
		.then(res=>res.text())
		.then(res => {
			toProcess.push(res);
		})
		.catch(err=>console.log(err));
	}

	// start fetching
	fetch(baseDailyDir+'2021/QTR1/index.json', {headers: {"User-Agent": "F4 Analytics"}})
	.then(res=>res.json())
	.then(res => {
		let dirs = res.directory.item;
		for (let i = 0; i < dirs.length; i++) {
			// get idx forms sorted by form name
			if (dirs[i].name.indexOf('form') == 0) {
				console.log(baseDailyDir+'2021/QTR1/'+dirs[i].href);
				fetch(baseDailyDir+'2021/QTR1/'+dirs[i].href, {headers: {"User-Agent": "F4 Analytics"}})
				.then(res=>res.text())
				.then(res => {
					// get individual forms
					let forms = parseIdx(res);
					for (let j = 0; j < forms.length; j++) {
						toFetch.push(baseDir+forms[j][4]);
					}
					setInterval(fetchForms, 150);
				})
				.catch(err=>console.log(err));
				break;
			}
		}
	})
	.catch(err => console.log(err));
}

getF4Forms();
