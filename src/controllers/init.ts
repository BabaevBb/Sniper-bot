import { Context } from "grammy";
import User from "../models/User";
import { buyToken, sellToken } from "../utils/trade";
import TonWeb from "tonweb";
import { ConversationFlavor } from "@grammyjs/conversations";
import { Bot, Api, RawApi } from "grammy";
import { DEX, pTON } from "@ston-fi/sdk";
import { mnemonicToKeyPair } from "tonweb-mnemonic";
import { endpoint } from "../config";
import BN from "bn.js";

type CusContext = Context & ConversationFlavor;

export const init = async (bot: Bot<CusContext, Api<RawApi>>) => {
  const users = await User.find({});

  const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const id = user.user;

    if (user.autosell?.actived === true) {
      if (user.autosell?.category === "time") {
        const left =
          (user.autosell?.startAt?.getTime() ?? 0) +
          (user.autosell?.time ?? 0) * 1000 -
          Date.now();

        const timer = setTimeout(async () => {
          try {
            let user = await User.findOne({ user: id });

            if (
              !user ||
              !user.autosell ||
              !user.autosell.token ||
              !user.autosell.amount
            ) {
              return;
            }

            try {
              await sellToken(
                user.wallet.split(" "),
                user.autosell.token,
                user.autosell.amount
              );

              await bot.api.sendMessage(
                id,
                "Auto Sell transaction submited successfully! Please wait for a few minutes"
              );
            } catch (err) {
              console.log(err);
              await bot.api.sendMessage(
                id,
                "Failed to send the auto sell transaction. Please try again later."
              );
            }
            user.autosell = {
              actived: false,
            };
            await user.save();
          } catch (err) {
            console.log(err);
          }
        }, left);

        await User.findOneAndUpdate(
          { user: id },
          { "autosell.timerId": timer[Symbol.toPrimitive]() }
        );
      } else if (user.autosell?.category === "height") {
        const timer = setInterval(async () => {
          try {
            let user = await User.findOne({ user: id });

            if (
              !user ||
              !user.autosell ||
              !user.autosell.token ||
              !user.autosell.amount ||
              !user.autosell.startPrice ||
              !user.autosell.height
            ) {
              return;
            }

            const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
            const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
              publicKey: keypair.publicKey,
              wc: 0,
            });

            const router = new DEX.v1.Router({
              tonApiClient: wallet.provider,
            });

            const pool = await router.getPool({
              token0: pTON.v1.address,
              token1: user.autosell.token,
            });

            if (!pool) return;

            const poolData = await pool.getData();

            const expectedOutput = await pool.getExpectedOutputs({
              amount: TonWeb.utils.toNano(user.autosell.amount.toString()),
              jettonWallet: poolData.token0WalletAddress,
            });

            if (
              expectedOutput.jettonToReceive.gte(
                new BN(user.autosell.startPrice)
                  .mul(new BN((100 + user.autosell.height) * 100))
                  .div(new BN(10000))
              )
            ) {
              try {
                clearInterval(user.autosell?.timerId ?? 0);
                await sellToken(
                  user.wallet.split(" "),
                  user.autosell.token,
                  user.autosell.amount
                );

                await bot.api.sendMessage(
                  id,
                  "Auto Sell transaction submited successfully! Please wait for a few minutes"
                );
              } catch (err) {
                console.log(err);
                await bot.api.sendMessage(
                  id,
                  "Failed to send the auto sell transaction. Please try again later."
                );
              }
              user.autosell = {
                actived: false,
              };
              await user.save();
            }
          } catch (err) {
            console.log(err);
          }
        }, 10000);
        await User.findOneAndUpdate(
          { user: id },
          { "autosell.timerId": timer[Symbol.toPrimitive]() }
        );
      }
    }

    if (user.minpulled?.actived === true) {
      const timer = setInterval(async () => {
        try {
          let user = await User.findOne({ user: id });

          if (
            !user ||
            !user.minpulled ||
            !user.minpulled.token ||
            !user.minpulled.minAmount ||
            !user.minpulled.buyAmount
          ) {
            return;
          }

          const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
          const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
            publicKey: keypair.publicKey,
            wc: 0,
          });

          const router = new DEX.v1.Router({
            tonApiClient: wallet.provider,
          });

          const pool = await router.getPool({
            token0: pTON.v1.address,
            token1: user.minpulled.token,
          });

          if (!pool) return;

          const poolData = await pool.getData();

          if (
            poolData.reserve0.gte(
              TonWeb.utils.toNano(user.minpulled.minAmount.toString())
            )
          ) {
            try {
              await buyToken(
                user.wallet.split(" "),
                user.minpulled.token,
                user.minpulled.buyAmount
              );
              await bot.api.sendMessage(
                id,
                "Submitted the transaction successfully. Please wait for a few minutes..."
              );
            } catch (err) {
              console.log(err);
              await bot.api.sendMessage(
                id,
                "Failed to send the transaction. Please try again later..."
              );
            }
          }
        } catch (err) {
          console.log(err);
        }
      }, 10000);
      await User.findOneAndUpdate(
        { user: id },
        { "minpulled.timerId": timer[Symbol.toPrimitive]() }
      );
    }
  }
};
