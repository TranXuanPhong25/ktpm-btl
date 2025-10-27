const USER_SERVICE_URI =
   process.env.USER_SERVICE_URI || "http://localhost:5000";
const axios = require("axios");

class UserService {
   //TODO: createUser through gRPC
   async createUser({ name, email, password }) {
      const { data: user } = await axios.post(
         `${USER_SERVICE_URI}/api/users/register`,
         { name, email, password }
      );
      return user;
   }

   //TODO: checkCredentials through gRPC
   async checkCredentials(email, password) {
      const { data: user } = await axios.post(
         `${USER_SERVICE_URI}/api/users/login`,
         {
            email,
            password,
         }
      );
      return user;
   }
}

module.exports = new UserService();
