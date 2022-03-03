const {MongoClient} = require('mongodb');
const url= 'mongodb://lvn.ddns.net:27017';
const client = new MongoClient(url);
const dbName = 'HNAPP';
const mongoose = require('mongoose');
const {Schema} = mongoose;

async function main()
{
    await client.connect();
    console.log('Connected successfully to server!');
    const db = client.db(dbName);
    const collection = db.collection('Collection1');

    /* const insertResult = await collection.insertMany([{ a: 1 }, { a: 2 }, { a: 3 }]);
    console.log('Inserted documents =>',insertResult); 
    const findResult = await collection.find({}).toArray();
    console.log('Found documents',findResult);
    

    const filteredDocs = await collection.find({a:3}).toArray();
    console.log('Found documents filtered by {a:3} =>',filteredDocs);
    const updateResult = await collection.updateOne({b:1},{$set: {a:3}});
    console.log('Updated documents =>',updateResult);*/

    const deleteResult = await collection.deleteMany({a:3});
    console.log('Deleted documents =>',deleteResult);

    

    return 'done';
}

async function main2()
{
    await mongoose.connect('mongodb://lvn.ddns.net:27017/HNAPP');
    const kittySchema = new mongoose.Schema(
        {
            name:String
        }
    );
    kittySchema.methods.speak = function speak() {
        const greeting = this.name ? "Meow name is " + this.name : "I dont have a name";
        console.log(greeting);
    }

    const Kitten = mongoose.model('Kitten',kittySchema);
    const silence = new Kitten({name:'Silence'});
    console.log(silence.name);
    
   
    const fluffy = new Kitten({name:'Fluppy'});
    const fluffy1 = new Kitten({name:'Scubidoo'});
    fluffy.speak();
    fluffy1.speak();

    //await fluffy.save();
    //await fluffy1.save();

    const kittens = await Kitten.find({name:'Scubidoo'});
    console.log(kittens);

}
async function main3()
{
    const options ={
        socketTimeoutMS: 45000
    }
    await mongoose.connect('mongodb://lvn.ddns.net:27017/HNAPP',options);
    const blogSchema = new Schema({
        title: String,
        author: String,
        body: String,
        comments: [{body: String, date: Date}],
        date: {type: Date, default: Date.now},
        hidden: Boolean,
        meta: {
            votes: Number,
            favs: Number
        }
    });

    const Blog = mongoose.model('Blog', blogSchema);
   

}
main3().catch(error=>console.log(error));