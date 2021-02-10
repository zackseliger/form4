const fetch = require('node-fetch');
const { DOMParser } = require('xmldom');

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

// parse form 4 transaction from text
function parseTransaction(text) {
	let xmlDoc = (new DOMParser()).parseFromString(text, "text/xml");
	// console.log(text);
	console.log(xmlDoc.getElementsByTagName("periodOfReport")[0].textContent);
	console.log(xmlDoc.getElementsByTagName("issuerCik")[0].textContent);
}

// get all daily forms
fetch(baseDailyDir+'2021/QTR1/index.json')
.then(res=>res.json())
.then(res => {
	let dirs = res.directory.item;
	for (let i = 0; i < dirs.length; i++) {
		// get idx forms sorted by form name
		if (dirs[i].name.indexOf('form') == 0) {
			fetch(baseDailyDir+'2021/QTR1/'+dirs[i].href)
			.then(res=>res.text())
			.then(res => {
				// get individual transactions
				let forms = parseIdx(res);
				for (let j = 0; j < forms.length; j++) {
					// let transaction = parseTransaction(forms[j])
					fetch(baseDir+forms[j][4])
					.then(res=>res.text())
					.then(res => {
						parseTransaction(res);
					})
					.catch(err=>console.log(err));
					break;
				}
			})
			.catch(err=>console.log(err));
			break;
		}
	}
})
.catch(err => console.log(err));