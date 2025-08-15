// Sample JavaScript file for testing refactoring functionality
// This code has intentional issues that should be improved during refactoring

var userName = "john_doe";
var userAge = 25;
var userEmail = "john@example.com";

function validateUser(user_name, user_age, user_email) {
    if (user_name == null || user_name == "") {
        return false;
    }
    if (user_age < 18) {
        return false;
    }
    if (user_email.indexOf("@") == -1) {
        return false;
    }
    return true;
}

function processUserData() {
    var result = validateUser(userName, userAge, userEmail);
    if (result == true) {
        console.log("User is valid");
        // More processing...
        var userData = new Object();
        userData.name = userName;
        userData.age = userAge;
        userData.email = userEmail;
        return userData;
    } else {
        console.log("User is invalid");
        return null;
    }
}

// Usage
var user = processUserData();
if (user != null) {
    console.log("Processing user: " + user.name);
}