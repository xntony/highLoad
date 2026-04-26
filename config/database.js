const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  define: { timestamps: true },
  pool: {
    max: 90,       // max connections
    min: 5,        // keep 5 alive
    acquire: 30000, // max ms to get a connection
    idle: 10000    // release after 10s idle
  }
});

// CLI-compatible config (required by sequelize-cli)
module.exports = sequelize;
module.exports.development = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres'
};