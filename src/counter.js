#!js api_version=1.0 name=counter

/**
 * @fileoverview Gears 2.0 function for maintaining counters for a given key at different time intervals defined by UNIX timestamps.  
 * Time intervals are started at 12:00 AM GMT.
 */

import { INTERVAL_NAMES } from './intervals.js';

const MONTH = 30*24*60*60;  //TTL for each timeslot counter (1 month, in secods)

const INTERVALS = [
    { 'slot': INTERVAL_NAMES.ONE_DAY,    'duration': 24*60*60 }, 
    { 'slot': INTERVAL_NAMES.THIRTY_MIN, 'duration': 30*60 }, 
    { 'slot': INTERVAL_NAMES.FIVE_MIN,   'duration': 5*60 },
    { 'slot': INTERVAL_NAMES.ONE_MIN,    'duration': 1*60 },
    { 'slot': INTERVAL_NAMES.ONE_SEC,    'duration': 1 }
];  

/**
 * Utility that derives the start of a time slot interval in UNIX timestamp format (seconds from Jan 1 1970)
 * @param {Object[]} intervals - array of time slot objects: slots names and durations in seconds
 * @param {number} start - UNIX timestamp
 * @returns {Object[]} JSON array of timeslots with their start times set at the beginning second of their respective intervals
 */
function getTimeslots(intervals, start) {
    let results = []
    intervals.forEach((interval) => {
        results.push({ 
            'slot': interval.slot, 
            'start': start - start % interval.duration 
        });
    });
    return results;
}

/**   
 * Gears function for obtaining the current counter on a given timeslot for a given key prefix.
 * @param {string} prefix - Redis key prefix, example:  account:1
 * @param {string} intervalName - Name designation of timeslots, example:  1min
 * @param {number} start - optional start UNIX timestamp
 * @returns {Object} - JSON object containing the full key name (with timeslot annotation) and its associated counter value
*/
redis.registerAsyncFunction('fetch', async (asyncClient, prefix, intervalName, start = Math.floor(Date.now() / 1000)) => {
    redis.log(`function get, prefix: ${prefix}, intervalName: ${intervalName}, start: ${start}`);
    const slots = getTimeslots(INTERVALS, start);
    let result;
    for (let slot of slots) {
        if (slot.slot == intervalName) {
            const key = `${prefix}:slot:${slot.slot}:start:${slot.start}`;
            let value;
            asyncClient.block((client) => {
                value = client.call('get', key);
            });
            if (!value) {
                value = '0';
            }
            result = { 'key': key, 'value': parseInt(value) };
            break;
        }
    }
    return result;
});

/**   
 * Gears function for incrementing counters for a given key prefix.  The key prefix is expanded into a full Redis key with timeslot
 * annotation.  That full key is used a Redis string and incremented.  The key is also given a TTL of 1 month.
 * @param {string} prefix - Redis key prefix, example:  account:1
 * @returns {Object[]} - JSON array containing the full key name (with timeslot annotation) and its associated counter value
*/
redis.registerAsyncFunction('incr', async (asyncClient, prefix) => {
    redis.log(`function incr, prefix: ${prefix}`);
    const slots = getTimeslots(INTERVALS, Math.floor(Date.now() / 1000));
    let results = [];
    slots.forEach((slot) => {
        const key = `${prefix}:slot:${slot.slot}:start:${slot.start}`;
        let value;
        asyncClient.block((client) => {
            value = client.call('incr', key);
            client.call('expire', key, MONTH.toString(), 'nx');
        });
        results.push({
            'key': key,
            'value': value
        });
    });
    return results;
});
