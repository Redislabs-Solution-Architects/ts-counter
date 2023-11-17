/**
 * @fileoverview Express JS REST API server.  Exposes the 2 Gears functions (fetch, incr) as REST endpoints.
 */

import { createClient } from 'redis';
import express from 'express';
import { INTERVAL_NAMES } from './intervals.js';

var client;
const intervals = Object.values(INTERVAL_NAMES);
const appPort = process.env.APP_PORT || 8000;  // this gets set in docker compose
const redisUrl = process.env.REDIS_URL || 'redis://default:redis@localhost:12000'  // also set in docker compose
const app = express();

/**
 * Utility function for calculating elapsed time
 * @param {number[]} start - hrtime array (seconds, nanoseconds)
 * @param {number[]} finish - hrtime array (seconds, nanoseconds)
 * @returns - milliseconds
 */
function execTime(start, finish) {
    const finishMS = finish[0] * 1000 + finish[1] / 1000000;
    const startMS = start[0] * 1000 + start[1] / 1000000;
    return parseFloat((finishMS - startMS).toFixed(2));
}

app.use(express.json());

/**
 * Express route for executing Gear function for incrementing the timeslot counters for a given key prefix
 */
app.post('/prefixes/:prefix/increment', async (req, res) => {
    const prefix  = req.params.prefix;
    console.log(`app - POST: ${prefix}`);

    try {
        const start = process.hrtime();
        /** 
         * note below that the prefix is hash tagged prior to sending to the Redis Gear function.  This forces
         * the Gear function to execute on the same shard as the key.  This overcomes the current write limitation of Gears 2.x
         */ 
        const arr = await client.sendCommand(['TFCALLASYNC', 'counter.incr', '1', `{${prefix}}`]);
        const finish = process.hrtime();
        let results = [];
        arr.forEach((result) => {
            results.push({[result[0]]: result[1], [result[2]]: result[3]})
        });
        res.status(200).json({ 'results': results, 'latency': execTime(start, finish) });
    }
    catch (err) {
        console.error(`app - POST: ${err.message}`);
        res.status(400).json({ 'error': err.message });        
    }
});

/**
 * Express route for fetc
 */
app.get('/prefixes/:prefix/intervals/:interval', async (req, res) => {
    const prefix = req.params.prefix;
    const interval = req.params.interval;
    const intStart = req.query.start;  
    console.log(`app - GET: ${prefix}, ${interval}, ${intStart}`);
    if (!intervals.includes(interval)) {
        res.status(400).json({ 'error': 'invalid interval specified' });
        return;
    }

    try {
        const start = process.hrtime();
        let arr;
        if (intStart) {
            arr = await client.sendCommand(['TFCALLASYNC', 'counter.fetch', '1', `{${prefix}}`, interval, intStart]);
        }
        else {
            arr = await client.sendCommand(['TFCALLASYNC', 'counter.fetch', '1', `{${prefix}}`, interval]);
        }
        console.log(arr)
        const finish = process.hrtime();
        const result = { [arr[0]]: arr[1], [arr[2]]: arr[3] };
        res.status(200).json({ 'results': result, 'latency': execTime(start, finish) });
    }
    catch (err) {
        console.error(`app - GET: ${err.message}`);
        res.status(400).json({ 'error': err.message });  
    }
});

const server = app.listen(appPort, async () => {
    client = createClient({url: redisUrl});
    client.on('error', (err) => {
        console.error(err.message);
    });  
    await client.connect();
    console.log(`Server is up - http://localhost:${appPort}`);
});

/**
 * Graceful shutdown of the Express server
 */
process.on('SIGTERM', () => {
    console.log('Closing HTTP Server');
    server.close(() => {process.exit(0);});
})