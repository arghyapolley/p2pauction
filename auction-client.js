const RPC = require('@hyperswarm/rpc');
const DHT = require('hyperdht');
const Hypercore = require('hypercore');
const Hyperbee = require('hyperbee');
const crypto = require('crypto');

const main = async () => {
  const hcore = new Hypercore('./db/auction-client');
  const hbee = new Hyperbee(hcore, { keyEncoding: 'utf-8', valueEncoding: 'json' });
  await hbee.ready();

  const dhtSeed = (await hbee.get('dht-seed'))?.value || crypto.randomBytes(32);
  const dht = new DHT({
    port: 50001,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: '127.0.0.1', port: 30001 }]
  });
  await dht.ready();

  const rpc = new RPC({ dht });

  const openAuctionDetails = { item: 'Pic#1', price: 75, status: 'open' };
  await rpc.request(rpc.publicKey, 'openAuction', Buffer.from(JSON.stringify(openAuctionDetails), 'utf-8'));

  const bidDetails = { bidder: 'Client#2', amount: 80 };
  await rpc.request(rpc.publicKey, 'placeBid', Buffer.from(JSON.stringify(bidDetails), 'utf-8'));

  const closeDetails = { winner: 'Client#2', amount: 80 };
  await rpc.request(rpc.publicKey, 'closeAuction', Buffer.from(JSON.stringify(closeDetails), 'utf-8'));

  await rpc.destroy();
  await dht.destroy();
};

main().catch(console.error);
