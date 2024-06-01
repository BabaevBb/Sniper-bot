import { CallbackQueryContext, Context } from "grammy";

import User from "../models/User";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";

import config, { endpoint } from "../config";
import { generateMnemonic, mnemonicToKeyPair } from "tonweb-mnemonic";
import TonWeb from "tonweb";

type CusContext = Context & ConversationFlavor;
type CusConversation = Conversation<CusContext>;

const walletCardContent = async (mnemonic: string[] | undefined) => {
  if (mnemonic) {
    const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));

    const keypair = await mnemonicToKeyPair(mnemonic);

    const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
      publicKey: keypair.publicKey,
      wc: 0,
    });
    const address = await wallet.getAddress();
    const balance = await tonweb.getBalance(address);

    return [
      `<b>Your Wallet:</b>\n\nAddress: <code>${address.toString(
        true
      )}</code>\nBalance: <b>${TonWeb.utils.fromNano(
        balance
      )}</b> TON\n\n Tap to copy the address and send TON to deposit.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "View on Tonscan",
                url: `https://tonscan.org/address/${address.toString(true)}`,
              },
              { text: "Close", callback_data: "cancel" },
            ],
            [
              {
                text: "Transfer",
                callback_data: "wallet_transfer",
              },
            ],
            [
              { text: "Reset Wallet", callback_data: "wallet_reset" },
              {
                text: "Export Mnemonic",
                callback_data: "wallet_export",
              },
            ],
          ],
        },
      },
    ];
  }
};

export const start = async (ctx: CallbackQueryContext<Context>) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  const mnemonic = user.wallet?.split(" ");

  //@ts-ignore
  await ctx.reply(...(await walletCardContent(mnemonic)));
  await ctx.answerCallbackQuery();
};

export const reset = async (ctx: CallbackQueryContext<Context>) => {
  await ctx.reply(
    "Are you sure you want to reset your <b>TON Wallet</b>?\n\n<b>WARNING: This action is irreversible!</b>\nBot will generate a new wallet for you and discard your old one.",
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Cancel", callback_data: "cancel" },
            {
              text: "Confirm",
              callback_data: "wallet_reset_confirm",
            },
          ],
        ],
      },
    }
  );
  await ctx.answerCallbackQuery();
};

export const resetConfirm = async (ctx: CallbackQueryContext<Context>) => {
  const id = ctx.update.callback_query?.from.id;

  await ctx.deleteMessage();

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  const mnemonic = await generateMnemonic();
  user.wallet = mnemonic.join(" ");
  await user.save();

  await ctx.reply(`Your new wallet is generated successfully.`, {
    parse_mode: "HTML",
  });
  await ctx.answerCallbackQuery();
};

export const exportPrvkey = async (ctx: CallbackQueryContext<Context>) => {
  await ctx.reply("Are you sure you want to export your <b>Mnemonic</b>?", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Cancel", callback_data: "cancel" },
          {
            text: "Confirm",
            callback_data: "wallet_export_confirm",
          },
        ],
      ],
    },
  });
  await ctx.answerCallbackQuery();
};

export const exportPrvkeyConfirm = async (
  ctx: CallbackQueryContext<Context>
) => {
  const id = ctx.update.callback_query?.from.id;

  await ctx.deleteMessage();

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply(
    `Your <b>Mnemonic</b> is:
<code>${user.wallet}</code>

You can now i.e. import the key into a wallet. (tap to copy).
Delete this message once you are done.`,
    {
      parse_mode: "HTML",
    }
  );
  await ctx.answerCallbackQuery();
};

export const transferConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  try {
    const id = ctx.update.callback_query?.from.id;

    let user = await User.findOne({ user: id });

    if (!user) {
      return;
    }

    const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));

    const keypair = await mnemonicToKeyPair(user.wallet.split(" "));

    const wallet = new tonweb.wallet.all.v4R2(tonweb.provider, {
      publicKey: keypair.publicKey,
      wc: 0,
    });
    const address = await wallet.getAddress();
    const balance = await tonweb.getBalance(address);

    await ctx.reply(
      `<b>Balance</b>: ${
        Number(balance) / 1000000000
      } TON\n\nEnter <b>TON</b> amount to transfer:`,
      {
        parse_mode: "HTML",
      }
    );
    const { msg: amountMsg } = await conversation.waitFor("message");

    if (isNaN(Number(amountMsg.text))) {
      await ctx.reply("Invalid transfer amount");
      return;
    }
    let amount = Number(amountMsg.text);

    await ctx.reply("Enter recipient address:");
    let { msg: recipientMsg } = await conversation.waitFor("message");

    if (!recipientMsg.text || !TonWeb.Address.isValid(recipientMsg.text)) {
      await ctx.reply("Invalid recipient address");
      return;
    }

    const seqno = await wallet.methods.seqno().call();
    console.log(seqno);
    const transfer = await wallet.methods
      .transfer({
        secretKey: keypair.secretKey,
        toAddress: recipientMsg.text,
        amount: TonWeb.utils.toNano(amount.toString()),
        seqno: seqno ?? 0,
        sendMode: 3,
      })
      .send();

    console.log(transfer);
    await ctx.reply("Transaction submitted successfully!");
  } catch (err) {
    console.log(err);
    await ctx.reply("Failed to send the transaction");
  }
};

export const transfer = async (ctx: CallbackQueryContext<CusContext>) => {
  await ctx.conversation.exit();
  await ctx.conversation.reenter("wallet-transfer-conversation");

  await ctx.answerCallbackQuery();
};
