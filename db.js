const mongoose = require("mongoose");

// Connect this backend server to the local MongoDB database used by the project.
mongoose.connect("mongodb://127.0.0.1:27017/loginDB")
.then(() => console.log("DB Connected"))
.catch(err => console.log(err));
