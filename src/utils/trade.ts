import { DEX, pTON } from "@ston-fi/sdk";
import { mnemonicToKeyPair } from "tonweb-mnemonic";
import { endpoint } from "../config";
import TonWeb from "tonweb";
import BN from "bn.js";

export const buyToken = async (
  mnemonic: string[],
  token: string,
  amount: number,
  slippage?: number
) => {
  const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));
  const keypair = await mnemonicToKeyPair(mnemonic);
  const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
    publicKey: keypair.publicKey,
    wc: 0,
  });
  const address = await wallet.getAddress();

  const router = new DEX.v1.Router({
    tonApiClient: wallet.provider,
  });

  const pool = await router.getPool({
    token0: pTON.v1.address,
    token1: token,
  });

  if (!pool) return;

  const poolData = await pool.getData();

  const expectedOutput = await pool.getExpectedOutputs({
    amount: TonWeb.utils.toNano(amount.toString()),
    jettonWallet: poolData.token1WalletAddress,
  });

  console.log(expectedOutput.jettonToReceive.toString());

  const txParams = await router.buildSwapTonToJettonTxParams({
    userWalletAddress: address.toString(),
    proxyTonAddress: pTON.v1.address.toString(),
    offerAmount: TonWeb.utils.toNano(amount.toString()),
    askJettonAddress: token,
    minAskAmount: expectedOutput.jettonToReceive
      .mul(new BN(100 - (slippage ?? 10)))
      .div(new BN(100)),
  });

  const transfer = await wallet.methods
    .transfer({
      secretKey: keypair.secretKey,
      toAddress: txParams.to,
      amount: txParams.gasAmount,
      seqno: (await wallet.methods.seqno().call()) ?? 0,
      payload: txParams.payload,
      sendMode: 3,
    })
    .send();

  console.log(transfer);
};

export const sellToken = async (
  mnemonic: string[],
  token: string,
  amount: number,
  slippage?: number
) => {
  const tonweb = new TonWeb(
    new TonWeb.HttpProvider("https://toncenter.com/api/v2/jsonRPC", {
      apiKey:
        "5afdbd60ac50d39ca18b0a2b17341284b2000291ddf43dbcc0bc0b4e8e91f77c",
    })
  );
  const keypair = await mnemonicToKeyPair(mnemonic);
  const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
    publicKey: keypair.publicKey,
    wc: 0,
  });
  const address = await wallet.getAddress();

  const router = new DEX.v1.Router({
    tonApiClient: new TonWeb.HttpProvider(),
  });

  // const pool = await router.getPool({
  //   token0: token,
  //   token1: pTON.v1.address,
  // });

  // console.log(pool);

  // if (!pool) return;

  // const poolData = await pool.getData();

  // const expectedOutput = await pool.getExpectedOutputs({
  //   amount: TonWeb.utils.toNano(amount.toString()),
  //   jettonWallet: poolData.token0WalletAddress,
  // });

  // console.log(expectedOutput.jettonToReceive.toString());

  const txParams = await router.buildSwapJettonToTonTxParams({
    userWalletAddress: address.toString(),
    offerJettonAddress: token,
    offerAmount: TonWeb.utils.toNano(amount.toString()),
    proxyTonAddress: pTON.v1.address,
    minAskAmount: TonWeb.utils.toNano("0"),
    queryId: 12345,
  });

  const transfer = await wallet.methods
    .transfer({
      secretKey: keypair.secretKey,
      toAddress: txParams.to,
      amount: txParams.gasAmount,
      seqno: (await wallet.methods.seqno().call()) ?? 0,
      payload: txParams.payload,
      sendMode: 3,
    })
    .send();

  console.log(transfer);
};
