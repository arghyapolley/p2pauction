const RPC = require('@hyperswarm/rpc');
const DHT = require('hyperdht');
const Hypercore = require('hypercore');
const Hyperbee = require('hyperbee');
const crypto = require('crypto');

const main = async () => {
  const hcore = new Hypercore('./db/auction-server');
  const hbee = new Hyperbee(hcore, { keyEncoding: 'utf-8', valueEncoding: 'json' });
  await hbee.ready();

  const dhtSeed = (await hbee.get('dht-seed'))?.value || crypto.randomBytes(32);
  const dht = new DHT({
    port: 40001,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: '127.0.0.1', port: 30001 }]
  });
  await dht.ready();

  const rpcSeed = (await hbee.get('rpc-seed'))?.value || crypto.randomBytes(32);
  const rpc = new RPC({ seed: rpcSeed, dht });
  const rpcServer = rpc.createServer();
  await rpcServer.listen();

  console.log('RPC server started. Public key:', rpcServer.publicKey.toString('hex'));

  rpcServer.respond('openAuction', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));

    const notificationPayload = { type: 'auctionOpened', auctionDetails: req };
    await notifyAllNodes(notificationPayload);
  });

  rpcServer.respond('placeBid', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));
  
    const notificationPayload = { type: 'bidPlaced', bidDetails: req };
    await notifyAllNodes(notificationPayload);
  });

  rpcServer.respond('closeAuction', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));
  
    const notificationPayload = { type: 'auctionClosed', closingDetails: req };
    await notifyAllNodes(notificationPayload);
  });

  async function notifyAllNodes(payload) {
    const nodes = await dht.query(rpc.publicKey);
    const notifyPromises = nodes.map(async (node) => {
      try {
        await rpc.request(node, 'notify', Buffer.from(JSON.stringify(payload), 'utf-8'));
      } catch (error) {
        console.error('Error notifying node:', error.message);
      }
    });
    await Promise.all(notifyPromises);
  }
};

main().catch(console.error);
