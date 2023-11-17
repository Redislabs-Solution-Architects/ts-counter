#!/bin/bash
# Usage: start.sh
# Description:  Starts a 3-node Redis Enterpise cluster + Nodejs Express app server.  Loads RE with a 
# Redis Gears 2.0 function that is used by the app server to implement time slot aggregations.  Finally,
# executes a simulator that performs reads and writes to the Redis function via the Express app server.

echo -e "\n*** Start 3 Redis Enterprise Nodes ***"
docker compose --profile redis up -d

echo -e "\n*** Wait for Redis nodes to come on line ***"
curl -s -o /dev/null --retry 5 --retry-all-errors --retry-delay 3 -f -k -u "redis@redis.com:redis" https://localhost:19443/v1/bootstrap

echo -e "\n*** Build Redis Enterprise Cluster ***"
docker exec -it re1 /opt/redislabs/bin/rladmin cluster create name cluster.local username redis@redis.com password redis
docker exec -it re2 /opt/redislabs/bin/rladmin cluster join nodes 192.168.20.2 username redis@redis.com password redis
docker exec -it re3 /opt/redislabs/bin/rladmin cluster join nodes 192.168.20.2 username redis@redis.com password redis

echo -e "\n*** Build Database ***"
curl -s -o /dev/null -k -u "redis@redis.com:redis" https://localhost:19443/v1/bdbs -H "Content-Type:application/json" -d @db1.json

echo -e "\n*** Deploy Redis Function ***"
npm run deploy

echo -e "\n*** Start REST API Server ***"
docker compose --profile app up -d
sleep 1

echo -e "\n*** Run Simulator ***"
npm run sim