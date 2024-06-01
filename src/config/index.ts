import { getHttpEndpoint } from "@orbs-network/ton-access"
import dotenv from "dotenv"

dotenv.config()

if (!process.env.TG_BOT_TOKEN) {
  throw Error("INPUT YOUR TELEGRAM BOT TOKEN")
}

export let endpoint = ""

export const configEndpoint = async () => {
  endpoint = await getHttpEndpoint()
}

export default {
  MONGO_URI: process.env.MONGO_URI ?? "",
  TG_BOT_TOKEN: process.env.TG_BOT_TOKEN ?? "",
}
