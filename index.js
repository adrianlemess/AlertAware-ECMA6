import app from './app';

app.listen('7000', ()=> {
    console.log(`App is running on port ${app.get('port')} `);
})