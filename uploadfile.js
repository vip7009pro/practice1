const  fs = require('fs').promises;

async function readFile(filePath) {
    try {
      const data = await fs.readFile(filePath);
      console.log(data.toString());
    } catch (error) {
      console.error(`Got an error trying to read the file: ${error.message}`);
    }
  }

  async function openFile() {
    try {
      const csvHeaders = 'name,quantity,price'
      await fs.writeFile('\\\\192.168.1.55\\qc\\IMAGE\\groceries.csv', csvHeaders);
    } catch (error) {
      console.error(`Got an error trying to write to a file: ${error.message}`);
    }
  }

  async function addGroceryItem(name, quantity, price) {
    try {
      const csvLine = `\n${name},${quantity},${price}`
      await fs.writeFile('\\\\192.168.1.55\\qc\\IMAGE\\groceries.csv', csvLine, { flag: 'a' });
    } catch (error) {
      console.error(`Got an error trying to write to a file: ${error.message}`);
    }
  }

  (async function () {
    await openFile();
    await addGroceryItem('eggs', 12, 1.50);
    await addGroceryItem('nutella', 1, 4);
    await addGroceryItem('nutella', 1, 4);
    await addGroceryItem('nutella', 1, 4);
  })();

  readFile('\\\\192.168.1.55\\qc\\IMAGE\\groceries.csv');