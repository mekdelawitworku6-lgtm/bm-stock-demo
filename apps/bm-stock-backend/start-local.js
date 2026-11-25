process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5434';
process.env.DB_USERNAME = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_NAME = 'gelagle-stock-ims';
process.env.NODE_ENV = 'development';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.REDIS_DB = '0';
process.env.PORT = '3000';

require('./dist/main');
