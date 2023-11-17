/**
 * @fileoverview This is a REST client app to exercise the Gears counter functions.  It generates 100 (each) random reads and writes,
 * sums up the Redis-side latency for each, then yields the average latencies for reads and writes.
 */

import axios from 'axios';
import { INTERVAL_NAMES } from './intervals.js';

const APP_URL = 'http://localhost:8000';
const ITERATIONS = 100;  
const sleep = ms => new Promise(r => setTimeout(r, ms));  //'sleep' function (in ms)

/**
 * Redis Gear write operation (incr) in a REST wrapper
 * @param {string} prefix - REST call to the increment function
 * @returns - JSON result
 */
async function incr(prefix) {
    const res = await axios({
        method: 'POST',
        url: `${APP_URL}/prefixes/${prefix}/increment`,
        responseType: 'json'
    });
    return res.data;
}

/**
 * Redis Gear read operation (fetch) in a REST wrapper
 * @param {string} prefix - key prefix
 * @param {string} interval - interval type, example: 1min
 * @param {number} intStart - UNIX timestamp (seconds) of the start of the interval
 * @returns 
 */
async function fetch(prefix, interval, intStart) {
    const res = await axios({
        method: 'GET',
        url: `${APP_URL}/prefixes/${prefix}/intervals/${interval}?start=${intStart}`,
        responseType: 'json'
    });
    return res.data;
}

/**
 * Utility function for generating a random integer within a range
 * @param {number} min 
 * @param {number} max 
 * @returns - random int within min and max
 */
function randInt(min, max){
    return Math.floor(Math.random() * (max - min + 1) + min);
}

(async () => {
    let sum, data;

    console.log(`${ITERATIONS} iterations of random read/write operations at random time intervals (1 ms - 1 sec)`);
    
    // Writes
    const start = Math.floor(Date.now() / 1000);
    sum = 0
    for (let i=0; i < ITERATIONS; i++) {
        data = await incr(`account:${randInt(1, 10)}`);
        sum += data.latency;
        await sleep(randInt(1, 1000));
    }
    const finish = Math.floor(Date.now() / 1000);
    const aveWriteLatency = (sum / ITERATIONS).toFixed(2);
    console.log(`Ave Write Latency: ${aveWriteLatency} ms`);
    
    // Reads
    sum = 0
    const intervals = Object.values(INTERVAL_NAMES);
    for (let i=0; i < ITERATIONS; i++) {
        data = await fetch(`account:${randInt(1, 10)}`, intervals[randInt(0, intervals.length-1)], randInt(start, finish));
        sum += data.latency;
        await sleep(randInt(1, 1000));
    }
    const aveReadLatency = (sum / ITERATIONS).toFixed(2);
    console.log(`Ave Read Latency:  ${aveReadLatency} ms`);
})();