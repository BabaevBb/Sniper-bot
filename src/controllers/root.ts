import { CommandContext, Context } from "grammy";
import User from "../models/User";
import { generateMnemonic, mnemonicToKeyPair } from "tonweb-mnemonic";
import TonWeb from "tonweb";
import { endpoint } from "../config";
import { ALLOWED_USERS } from "../constants";

export const start = async (ctx: CommandContext<Context>) => {
  const id = ctx.message?.from.id;

  // if (ALLOWED_USERS.find((item) => item === id) === undefined) {
  //   await ctx.reply("You don't have any permission to access the bot");
  //   return;
  // }

  let user = await User.findOne({ user: id });

  if (!user) {
    const mnemonic = await generateMnemonic();

    user = new User({ user: id, wallet: mnemonic.join(" ") });
    await user.save();
  }

  const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));

  const keypair = await mnemonicToKeyPair(user.wallet.split(" "));
  const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
    publicKey: keypair.publicKey,
    wc: 0,
  });
  const address = await wallet.getAddress();

  await ctx.reply(
    `<b>Welcome to TONBot</b>\n\n You can start trading with your TONBot wallet address:\n<code>${address.toString(
      true
    )}</code> (tap to copy)\n\n`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Buy", callback_data: "buy" },
            { text: "Sell", callback_data: "sell" },
          ],
          [
            { text: "Auto Sell", callback_data: "auto-sell" },
            { text: "Min Pulled", callback_data: "min-pulled" },
          ],
          [
            { text: "Wallet", callback_data: "wallet" },
            {
              text: "Settings",
              callback_data: "settings",
            },
          ],
        ],
      },
    }
  );
};

export const help = async (ctx: CommandContext<Context>) => {
  await ctx.reply(`Help`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "Close", callback_data: "cancel" }]],
    },
  });
};
