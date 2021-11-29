// [ECMAScript 5 Syntax]

var isNetworkOK = true;

// This function return a Promise
function downloadFile(url)  {
    console.log("Start downloading file ..."); // ***
    // A Promise
     return new Promise (
        function (resolve, reject) 
        { 
            if (isNetworkOK) {               
                setTimeout(() => {
                    console.log("Complete the download process!"); // ***
                    var file = {
                        fileName: 'file.mp4',
                        fileContent: '...',
                        fileSize: '3 MB'
                    };
                    resolve(file); // fulfilled
                }, 2000);
                
            } 
            else 
            {
                setTimeout(() => {
                    console.log("File download process failed!"); // ***
                    var error = new Error('There is a problem with the network.');
                    reject(error); // reject                
                }, 2000);
               
            }

        }
    );     
}

function openFile(file) {
    console.log("Start opening file ..."); // ***
    var willFileOpen = new Promise(
        function (resolve, reject) {
            setTimeout(() => {
                var message = "File info: " + file.fileName + " opened!"            
                 resolve(message);
            }, 1000);
             
        }
    );

    return willFileOpen; // Return a Promise.
}

// Call downloadFile(..) function:
// Returns a Promise object:
var willIGetAFile = downloadFile("http://example.com/file.mp3");

willIGetAFile
.then(openFile) // Chain it!
.then(function (fulfilled) { // If successful fileOpen.
    // Get a message after file opened!
    // Output: File file.mp3 opened!
    console.log(fulfilled);
})
.catch(function (error) {
        // Network Error!
        // Output: There is a problem with the network.
        console.log(error.message);
});