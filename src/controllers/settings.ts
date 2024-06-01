import { CallbackQueryContext, Context } from "grammy";

import User from "../models/User";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";

type CusContext = Context & ConversationFlavor;
type CusConversation = Conversation<CusContext>;

export const settingsContent = (user: any) => {
  return [
    "<b>Settings:</b>",
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `${user.autobuy?.actived ? "🟢" : "🔴"} Auto Buy`,
              callback_data: "auto_buy_active",
            },
          ],
          [
            {
              text: `Amount: ${user.autobuy?.amount ?? 1} TON`,
              callback_data: "auto_buy_amount",
            },
            {
              text: `Slippage: ${user.autobuy?.slippage ?? 0.1} %`,
              callback_data: "auto_buy_slippage",
            },
          ],
          [
            {
              text: `${user.minpulled?.actived ? "🟢" : "🔴"} Min Pulled`,
              callback_data: "min_pulled_active",
            },
          ],
          [
            {
              text: `Min Amount: ${user.minpulled?.minAmount ?? 1} TON`,
              callback_data: "min_pulled_min_amount",
            },
            {
              text: `Buy Amount: ${user.minpulled?.buyAmount ?? 1} TON`,
              callback_data: "min_pulled_buy_amount",
            },
          ],
          // [
          //   {
          //     text: `${user.autosell?.actived ? "🟢" : "🔴"} Auto Sell`,
          //     callback_data: "auto_sell_active",
          //   },
          // ],
          // [
          //   {
          //     text: `Amount: ${user.autosell?.amount ?? 1} TON`,
          //     callback_data: "auto_sell_amount",
          //   },
          //   {
          //     text: `Slippage: ${user.autosell?.slippage ?? 0.1} %`,
          //     callback_data: "auto_sell_slippage",
          //   },
          // ],
          [{ text: "Cancel", callback_data: "cancel" }],
        ],
      },
    },
  ];
};

export const start = async (ctx: CallbackQueryContext<CusContext>) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  //@ts-ignore
  await ctx.reply(...settingsContent(user));

  await ctx.answerCallbackQuery();
};

export const autoBuyActive = async (ctx: CallbackQueryContext<CusContext>) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  const actived = !user.autobuy?.actived;
  user.autobuy = {
    actived: actived,
    amount: user.autobuy?.amount ?? 1,
    slippage: user.autobuy?.slippage ?? 0.1,
  };

  await user.save();
  try {
    await ctx.editMessageReplyMarkup({
      // @ts-ignore
      reply_markup: settingsContent(user)[1].reply_markup,
    });
  } catch (err) {}
  await ctx.reply(`Auto Buy ${actived ? "Activated 🟢" : "Deactivated 🔴"}`);

  await ctx.answerCallbackQuery();
};

export const autoBuyAmountConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply("Enter your new Auto Buy Amount in TON. Example: 1", {
    reply_markup: { force_reply: true },
  });
  const {
    msg: { text: amount },
  } = await conversation.waitFor("message");

  if (
    !amount ||
    isNaN(Number(amount)) ||
    isNaN(parseFloat(amount)) ||
    parseFloat(amount) <= 0
  ) {
    await ctx.reply("<i>Invalid auto buy amount</i>", { parse_mode: "HTML" });
    return;
  }
  user.autobuy = {
    actived: user.autobuy?.actived ?? false,
    amount: Number(amount),
    slippage: user.autobuy?.slippage ?? 0.1,
  };
  await user.save();
  try {
    await ctx.editMessageReplyMarkup({
      reply_markup:
        // @ts-ignore
        settingsContent(user)[1].reply_markup,
    });
  } catch (err) {}
  await ctx.reply(`Auto Buy Amount set to ${Number(amount)} TON`);
};

export const autoBuyAmount = async (ctx: CallbackQueryContext<CusContext>) => {
  await ctx.conversation.exit();
  await ctx.conversation.enter("autobuy-amount-conversation");

  await ctx.answerCallbackQuery();
};

export const autoBuySlippageConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply("Enter your new Auto Buy Slippage (0~50). Example: 0.1", {
    reply_markup: { force_reply: true },
  });
  const {
    msg: { text: slippage },
  } = await conversation.waitFor("message");

  if (
    !slippage ||
    isNaN(Number(slippage)) ||
    isNaN(parseFloat(slippage)) ||
    parseFloat(slippage) <= 0 ||
    parseFloat(slippage) >= 50
  ) {
    await ctx.reply("<i>Invalid auto buy slippage</i>", { parse_mode: "HTML" });
    return;
  }
  user.autobuy = {
    actived: user.autobuy?.actived ?? false,
    amount: user.autobuy?.amount ?? 1,
    slippage: Number(slippage),
  };
  await user.save();
  try {
    await ctx.editMessageReplyMarkup({
      reply_markup:
        // @ts-ignore
        settingsContent(user)[1].reply_markup,
    });
  } catch (err) {}
  await ctx.reply(`Auto Buy Slippage set to ${Number(slippage)} %`);
};

export const autoBuySlippage = async (
  ctx: CallbackQueryContext<CusContext>
) => {
  await ctx.conversation.exit();
  await ctx.conversation.enter("autobuy-slippage-conversation");

  await ctx.answerCallbackQuery();
};

export const minPulledActive = async (
  ctx: CallbackQueryContext<CusContext>
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  const actived = !user.minpulled?.actived;
  user.minpulled = {
    actived: actived,
    minAmount: user.minpulled?.minAmount ?? 1,
    buyAmount: user.minpulled?.buyAmount ?? 1,
  };

  await user.save();
  try {
    await ctx.editMessageReplyMarkup({
      // @ts-ignore
      reply_markup: settingsContent(user)[1].reply_markup,
    });
  } catch (err) {}
  await ctx.reply(`Min Pulled ${actived ? "Activated 🟢" : "Deactivated 🔴"}`);

  await ctx.answerCallbackQuery();
};

export const minPulledMinAmountConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply("Enter your Min Pulled Amount in TON. Example: 1", {
    reply_markup: { force_reply: true },
  });
  const {
    msg: { text: amount },
  } = await conversation.waitFor("message");

  if (
    !amount ||
    isNaN(Number(amount)) ||
    isNaN(parseFloat(amount)) ||
    parseFloat(amount) <= 0
  ) {
    await ctx.reply("<i>Invalid min pulled amount</i>", { parse_mode: "HTML" });
    return;
  }
  user.minpulled = {
    actived: user.minpulled?.actived ?? false,
    minAmount: Number(amount),
    buyAmount: user.minpulled?.buyAmount ?? 1,
  };
  await user.save();
  try {
    await ctx.editMessageReplyMarkup({
      reply_markup:
        // @ts-ignore
        settingsContent(user)[1].reply_markup,
    });
  } catch (err) {}
  await ctx.reply(`Min Pulled Amount set to ${Number(amount)} TON`);
};

export const minPulledMinAmount = async (
  ctx: CallbackQueryContext<CusContext>
) => {
  await ctx.conversation.exit();
  await ctx.conversation.enter("min-pulled-min-amount-conversation");

  await ctx.answerCallbackQuery();
};

export const minPulledBuyAmountConversation = async (
  conversation: CusConversation,
  ctx: CusContext
) => {
  const id = ctx.update.callback_query?.from.id;

  let user = await User.findOne({ user: id });

  if (!user) {
    return;
  }

  await ctx.reply("Enter your Min Pulled Buy Amount in TON. Example: 1", {
    reply_markup: { force_reply: true },
  });
  const {
    msg: { text: amount },
  } = await conversation.waitFor("message");

  if (
    !amount ||
    isNaN(Number(amount)) ||
    isNaN(parseFloat(amount)) ||
    parseFloat(amount) <= 0
  ) {
    await ctx.reply("<i>Invalid min pulled buy amount</i>", {
      parse_mode: "HTML",
    });
    return;
  }
  user.minpulled = {
    actived: user.minpulled?.actived ?? false,
    minAmount: user.minpulled?.minAmount ?? 1,
    buyAmount: Number(amount),
  };
  await user.save();
  try {
    await ctx.editMessageReplyMarkup({
      reply_markup:
        // @ts-ignore
        settingsContent(user)[1].reply_markup,
    });
  } catch (err) {}
  await ctx.reply(`Min Pulled Buy Amount set to ${Number(amount)} TON`);
};

export const minPulledBuyAmount = async (
  ctx: CallbackQueryContext<CusContext>
) => {
  await ctx.conversation.exit();
  await ctx.conversation.enter("min-pulled-buy-amount-conversation");

  await ctx.answerCallbackQuery();
};
