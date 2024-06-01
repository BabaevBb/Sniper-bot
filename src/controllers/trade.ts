import { CallbackQueryContext, Context } from "grammy";
import User from "../models/User";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import { sleep } from "../utils";
import { endpoint } from "../config";
import { DEX, pTON } from "@ston-fi/sdk";
import TonWeb from "tonweb";
import { mnemonicToKeyPair } from "tonweb-mnemonic";
import { buyToken, sellToken } from "../utils/trade";
import moment from "moment";
import BN from "bn.js";

type CusContext = Context & ConversationFlavor;
type CusConversation = Conversation<CusContext>;

export const buyConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply("Enter token address to buy:", {
    reply_markup: { force_reply: true },
  });

  const { msg: tokenMsg } = await conversation.waitFor("message");

  if (!tokenMsg.text || !TonWeb.Address.isValid(tokenMsg.text)) {
    await ctx.reply("Invalid token address");
    return;
  }

  const token = tokenMsg.text;

  const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));
  const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
  const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
    publicKey: keypair.publicKey,
    wc: 0,
  });
  const address = await wallet.getAddress();
  const balance = Number(
    TonWeb.utils.fromNano(await tonweb.getBalance(address))
  );

  await ctx.reply(
    `Balance: <b>${balance} TON</b>
Enter <b>TON</b> amount to buy:`,
    {
      parse_mode: "HTML",
      reply_markup: { force_reply: true },
    }
  );

  const { msg: amountMsg } = await conversation.waitFor("message");

  if (
    !amountMsg.text ||
    isNaN(Number(amountMsg.text)) ||
    Number(amountMsg.text) <= 0
  ) {
    await ctx.reply("Invalid TON amount");
    return;
  }

  const amount = Number(amountMsg.text);

  if (balance < amount + 0.2 || balance < 0.2) {
    await ctx.reply("Insufficient TON balance");
    return;
  }

  try {
    await buyToken(user.wallet.split(" "), token, amount);
    await ctx.reply(
      "Submitted the transaction successfully. Please wait for a few minutes..."
    );
  } catch (err) {
    console.log(err);
    await ctx.reply(
      "Failed to send the transaction. Please try again later..."
    );
  }
};

export const buy = async (ctx: CallbackQueryContext<CusContext>) => {
  await ctx.conversation.exit();
  await ctx.conversation.reenter("buy-conversation");
  await ctx.answerCallbackQuery();
};

export const sellConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply("Enter token address to sell:", {
    reply_markup: { force_reply: true },
  });

  const { msg: tokenMsg } = await conversation.waitFor("message");

  if (!tokenMsg.text || !TonWeb.Address.isValid(tokenMsg.text)) {
    await ctx.reply("Invalid token address");
    return;
  }

  const token = tokenMsg.text;

  const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));
  const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
  const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
    publicKey: keypair.publicKey,
    wc: 0,
  });
  const address = await wallet.getAddress();

  // @ts-ignore
  const jettonMinter = new TonWeb.token.jetton.JettonMinter(tonweb.provider, {
    address: token,
  });
  const jettonWalletAddress = await jettonMinter.getJettonWalletAddress(
    address
  );

  const jettonWallet = new TonWeb.token.jetton.JettonWallet(tonweb.provider, {
    address: jettonWalletAddress,
  });
  let jettonData;
  let jettonBalance;
  try {
    jettonData = await jettonWallet.getData();

    jettonBalance = Number(TonWeb.utils.fromNano(jettonData.balance));
  } catch (err) {
    console.log(err);
    await ctx.reply("Failed to fetch your token data");
    return;
  }

  await ctx.reply(
    `Balance: ${jettonBalance}
Enter token amount to sell:`,
    {
      parse_mode: "HTML",
      reply_markup: { force_reply: true },
    }
  );

  const { msg: amountMsg } = await conversation.waitFor("message");

  if (
    !amountMsg.text ||
    isNaN(Number(amountMsg.text)) ||
    Number(amountMsg.text) <= 0
  ) {
    await ctx.reply("Invalid token amount");
    return;
  }

  const amount = Number(amountMsg.text);

  const balance = Number(
    TonWeb.utils.fromNano(await tonweb.getBalance(address))
  );

  if (jettonBalance < amount) {
    await ctx.reply("Insufficient balance");
    return;
  }

  if (balance < 0.2) {
    await ctx.reply("Insufficient TON balance");
    return;
  }

  try {
    await sellToken(user.wallet.split(" "), token, amount);
    await ctx.reply(
      "Submitted the transaction successfully. Please wait for a few minutes..."
    );
  } catch (err) {
    console.log(err);
    await ctx.reply(
      "Failed to send the transaction. Please try again later..."
    );
  }
};

export const sell = async (ctx: CallbackQueryContext<CusContext>) => {
  await ctx.conversation.exit();
  await ctx.conversation.reenter("sell-conversation");
  await ctx.answerCallbackQuery();
};

export const autoBuy = async (ctx: CusContext) => {
  const id = ctx.message?.from.id;
  const token = ctx.message?.text;

  const user = await User.findOne({ user: id });
  if (!token || !user || !user.autobuy || !user.autobuy?.actived) return;

  if (!TonWeb.Address.isValid(token)) {
    await ctx.reply("Invalid token address");
    return;
  }

  const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));
  const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
  const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
    publicKey: keypair.publicKey,
    wc: 0,
  });
  const address = await wallet.getAddress();
  const balance = Number(
    TonWeb.utils.fromNano(await tonweb.getBalance(address))
  );

  if (balance < user.autobuy.amount + 0.2 || balance < 0.2) {
    await ctx.reply("Insufficient TON balance");
    return;
  }

  try {
    await buyToken(
      user.wallet.split(" "),
      token,
      user.autobuy.amount ?? 1,
      user.autobuy.slippage ?? 5
    );
    await ctx.reply(
      "Submitted the transaction successfully. Please wait for a few minutes..."
    );
  } catch (err) {
    console.log(err);
    await ctx.reply(
      "Failed to send the transaction. Please try again later..."
    );
  }
};

export const autoSell = async (ctx: CallbackQueryContext<CusContext>) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply(
    `<b>Auto Sell</b> ${
      user.autosell?.category === "height" || user.autosell?.category === "time"
        ? `\n\nCurrent configuration:
Type: <b>Certain ${user.autosell.category}</b>
${
  user.autosell.category === "height"
    ? `Height: <b>${user.autosell.height}%</b>`
    : `Time: <b>${user.autosell.time}s</b>`
}
Token: <code>${user.autosell.token}</code>
Set At: ${moment(user.autosell?.startAt ?? new Date()).format(
            "YYYY/MM/DD hh:mm:ss"
          )}`
        : ""
    }
`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Auto Sell ${user.autosell?.actived ? "🟢" : "🔴"}`,
              callback_data: "auto_sell_active",
            },
          ],
          [
            {
              text: "Certain Height",
              callback_data: "auto_sell_height",
            },
            {
              text: "Certain Time",
              callback_data: "auto_sell_time",
            },
          ],
          [{ text: "Close", callback_data: "cancel" }],
        ],
      },
    }
  );
  await ctx.answerCallbackQuery();
};

export const autoSellActive = async (ctx: CallbackQueryContext<CusContext>) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  const actived = user.autosell?.actived === true;
  if (actived) {
    await User.findOneAndUpdate({ user: id }, { autosell: {} });

    await ctx.reply(
      `Auto Sell ${!actived ? "Activated 🟢" : "Deactivated 🔴"}`
    );
  }

  await ctx.answerCallbackQuery();
};

export const autoSellHeightConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply("Enter token address to sell:", {
    reply_markup: { force_reply: true },
  });

  const { msg: tokenMsg } = await conversation.waitFor("message");

  if (!tokenMsg.text || !TonWeb.Address.isValid(tokenMsg.text)) {
    await ctx.reply("Invalid token address");
    return;
  }

  const token = tokenMsg.text;

  const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));
  const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
  const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
    publicKey: keypair.publicKey,
    wc: 0,
  });
  const address = await wallet.getAddress();

  // @ts-ignore
  const jettonMinter = new TonWeb.token.jetton.JettonMinter(tonweb.provider, {
    address: token,
  });
  const jettonWalletAddress = await jettonMinter.getJettonWalletAddress(
    address
  );

  const jettonWallet = new TonWeb.token.jetton.JettonWallet(tonweb.provider, {
    address: jettonWalletAddress,
  });
  let jettonData;
  let jettonBalance;
  try {
    jettonData = await jettonWallet.getData();
    jettonBalance = Number(TonWeb.utils.fromNano(jettonData.balance));
  } catch (err) {
    console.log(err);
    await ctx.reply("Failed to fetch your token data");
    return;
  }

  await ctx.reply(
    `Balance: ${jettonBalance}
Enter token amount to sell:`,
    {
      parse_mode: "HTML",
      reply_markup: { force_reply: true },
    }
  );

  const { msg: amountMsg } = await conversation.waitFor("message");

  if (
    !amountMsg.text ||
    isNaN(Number(amountMsg.text)) ||
    Number(amountMsg.text) <= 0
  ) {
    await ctx.reply("Invalid token amount");
    return;
  }

  const amount = Number(amountMsg.text);

  const balance = Number(
    TonWeb.utils.fromNano(await tonweb.getBalance(address))
  );

  if (jettonBalance < amount) {
    await ctx.reply("Insufficient balance");
    return;
  }

  if (balance < 0.2) {
    await ctx.reply("Insufficient TON balance");
    return;
  }

  await ctx.reply(`Enter the profit in %`, {
    parse_mode: "HTML",
    reply_markup: { force_reply: true },
  });

  const { msg: profitMsg } = await conversation.waitFor("message");

  if (
    !profitMsg.text ||
    isNaN(Number(profitMsg.text)) ||
    Number(profitMsg.text) <= 0 ||
    Number(profitMsg.text) >= 100
  ) {
    await ctx.reply("Invalid profit %");
    return;
  }

  const profit = Number(profitMsg.text);

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
    jettonWallet: poolData.token0WalletAddress,
  });

  clearInterval(user.autosell?.timerId ?? 0);

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

          await ctx.reply(
            "Auto Sell transaction submited successfully! Please wait for a few minutes"
          );
        } catch (err) {
          console.log(err);
          await ctx.reply(
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
    {
      "autosell.actived": true,
      "autosell.category": "height",
      "autosell.token": token,
      "autosell.amount": amount,
      "autosell.height": profit,
      "autosell.startPrice": expectedOutput.jettonToReceive.toString(),
      "autosell.startAt": new Date(),
      "autosell.timerId": timer[Symbol.toPrimitive](),
    }
  );

  await ctx.reply("Auto sell set successfully!");
};

export const autoSellHeight = async (ctx: CallbackQueryContext<CusContext>) => {
  await ctx.conversation.exit();
  await ctx.conversation.reenter("auto-sell-height-conversation");
  await ctx.answerCallbackQuery();
};

export const autoSellTimeConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply("Enter token address to sell:", {
    reply_markup: { force_reply: true },
  });

  const { msg: tokenMsg } = await conversation.waitFor("message");

  if (!tokenMsg.text || !TonWeb.Address.isValid(tokenMsg.text)) {
    await ctx.reply("Invalid token address");
    return;
  }

  const token = tokenMsg.text;

  const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));
  const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
  const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
    publicKey: keypair.publicKey,
    wc: 0,
  });
  const address = await wallet.getAddress();

  // @ts-ignore
  const jettonMinter = new TonWeb.token.jetton.JettonMinter(tonweb.provider, {
    address: token,
  });
  const jettonWalletAddress = await jettonMinter.getJettonWalletAddress(
    address
  );

  const jettonWallet = new TonWeb.token.jetton.JettonWallet(tonweb.provider, {
    address: jettonWalletAddress,
  });
  let jettonData;
  let jettonBalance;
  try {
    jettonData = await jettonWallet.getData();
    jettonBalance = Number(TonWeb.utils.fromNano(jettonData.balance));
  } catch (err) {
    console.log(err);
    await ctx.reply("Failed to fetch your token data");
    return;
  }

  await ctx.reply(
    `Balance: ${jettonBalance}
Enter token amount to sell:`,
    {
      parse_mode: "HTML",
      reply_markup: { force_reply: true },
    }
  );

  const { msg: amountMsg } = await conversation.waitFor("message");

  if (
    !amountMsg.text ||
    isNaN(Number(amountMsg.text)) ||
    Number(amountMsg.text) <= 0
  ) {
    await ctx.reply("Invalid token amount");
    return;
  }

  const amount = Number(amountMsg.text);

  const balance = Number(
    TonWeb.utils.fromNano(await tonweb.getBalance(address))
  );

  if (jettonBalance < amount) {
    await ctx.reply("Insufficient balance");
    return;
  }

  if (balance < 0.2) {
    await ctx.reply("Insufficient TON balance");
    return;
  }

  await ctx.reply(`Enter the time in second`, {
    parse_mode: "HTML",
    reply_markup: { force_reply: true },
  });

  const { msg: timeMsg } = await conversation.waitFor("message");

  if (
    !timeMsg.text ||
    isNaN(Number(timeMsg.text)) ||
    Number(timeMsg.text) <= 0
  ) {
    await ctx.reply("Invalid time");
    return;
  }

  const time = Number(timeMsg.text);

  clearTimeout(user.autosell?.timerId ?? 0);

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

        await ctx.reply(
          "Auto Sell transaction submited successfully! Please wait for a few minutes"
        );
      } catch (err) {
        console.log(err);
        await ctx.reply(
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
  }, time * 1000);

  await User.findOneAndUpdate(
    { user: id },
    {
      "autosell.actived": true,
      "autosell.category": "time",
      "autosell.amount": amount,
      "autosell.token": token,
      "autosell.time": time,
      "autosell.startAt": new Date(),
      "autosell.timerId": timer[Symbol.toPrimitive](),
    }
  );

  await ctx.reply("Auto sell set successfully!");
};

export const autoSellTime = async (ctx: CallbackQueryContext<CusContext>) => {
  await ctx.conversation.exit();
  await ctx.conversation.reenter("auto-sell-time-conversation");
  await ctx.answerCallbackQuery();
};

export const minPulled = async (ctx: CallbackQueryContext<CusContext>) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply(
    `<b>Min Pulled</b>${
      user.minpulled?.actived === true
        ? `
Token: <code>${user.minpulled?.token}</code>
Min Amount: <b>${user.minpulled?.minAmount} TON</b>
Buy Amount: <b>${user.minpulled?.buyAmount} TON</b>`
        : ""
    }`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Min Pulled ${
                user.minpulled?.actived === true ? "🟢" : "🔴"
              }`,
              callback_data: "min-pulled-active",
            },
          ],
          [{ text: "Cancel", callback_data: "cancel" }],
        ],
      },
    }
  );

  await ctx.answerCallbackQuery();
};

export const minPulledActiveConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  clearInterval(user.minpulled?.timerId ?? 0);

  if (user.minpulled?.actived === true) {
    await User.findOneAndUpdate(
      { user: id },
      { "minpulled.actived": false, "minpulled.timerId": 0 }
    );

    await ctx.reply("Min Pulled Deactivated 🔴");
  } else {
    await ctx.reply("Enter token address to buy:", {
      reply_markup: { force_reply: true },
    });

    const { msg: tokenMsg } = await conversation.waitFor("message");

    if (!tokenMsg.text || !TonWeb.Address.isValid(tokenMsg.text)) {
      await ctx.reply("Invalid token address");
      return;
    }

    const token = tokenMsg.text;

    await ctx.reply(`Enter min pulled amount in TON:`, {
      parse_mode: "HTML",
      reply_markup: { force_reply: true },
    });

    const { msg: minAmountMsg } = await conversation.waitFor("message");

    if (
      !minAmountMsg.text ||
      isNaN(Number(minAmountMsg.text)) ||
      Number(minAmountMsg.text) <= 0
    ) {
      await ctx.reply("Invalid min pulled amount");
      return;
    }

    const minAmount = Number(minAmountMsg.text);

    const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));
    const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
    const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
      publicKey: keypair.publicKey,
      wc: 0,
    });
    const address = await wallet.getAddress();
    const balance = Number(
      TonWeb.utils.fromNano(await tonweb.getBalance(address))
    );

    await ctx.reply(
      `Balance: <b>${balance} TON</b>
Enter buy amount in TON:`,
      {
        parse_mode: "HTML",
        reply_markup: { force_reply: true },
      }
    );

    const { msg: buyAmountMsg } = await conversation.waitFor("message");

    if (
      !buyAmountMsg.text ||
      isNaN(Number(buyAmountMsg.text)) ||
      Number(buyAmountMsg.text) <= 0
    ) {
      await ctx.reply("Invalid buy amount");
      return;
    }

    const buyAmount = Number(buyAmountMsg.text);

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

        const router = new DEX.v1.Router({
          tonApiClient: wallet.provider,
        });

        const pool = await router.getPool({
          token0: pTON.v1.address,
          token1: user.minpulled.token,
        });

        console.log(user.minpulled.token, pool);

        if (!pool) return;

        const poolData = await pool.getData();

        console.log(poolData.reserve0.toString(), poolData.reserve1.toString());

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
            await ctx.reply(
              "Submitted the transaction successfully. Please wait for a few minutes..."
            );
          } catch (err) {
            console.log(err);
            await ctx.reply(
              "Failed to send the transaction. Please try again later..."
            );
          }
        }
      } catch (err) {
        console.log(err);
      }
    }, 10000);

    user.minpulled = {
      actived: true,
      token,
      minAmount,
      buyAmount,
      timerId: timer[Symbol.toPrimitive](),
    };

    await user.save();
    await ctx.reply("Min Pulled Activated 🟢");
  }
};

export const minPulledActive = async (
  ctx: CallbackQueryContext<CusContext>
) => {
  await ctx.conversation.exit();
  await ctx.conversation.reenter("min-pulled-active-conversation");
  await ctx.answerCallbackQuery();
};
