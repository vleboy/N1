
const athena = require('./lib/athena')
import { CODES, CHeraErr } from './lib/Codes'
import { ReHandler } from './lib/Response'
import { MerchantModel } from './model/MerchantModel'
import { GameRecordModel } from './model/GameRecordModel'

/**
 * 获取玩家游戏记录
 * @param {*} event 
 * @param {*} context 
 * @param {*} callback 
 */
async function getPlayerGameRecord(event, context, callback) {
  //json转换
  let [parserErr, requestParams] = athena.Util.parseJSON(event.body || {})
  if (parserErr) return callback(null, ReHandler.fail(parserErr))
  //检查参数是否合法
  let [checkAttError, errorParams] = athena.Util.checkProperties([
    { name: "apiKey", type: "S", min: 1 },
    { name: "startTime", type: "N" },
    { name: "lastTime", type: "N" }, //最后一条记录
    { name: "endTime", type: "N" },
    { name: "buId", type: "N" }
  ], requestParams)
  if (checkAttError) {
    Object.assign(checkAttError, { params: errorParams })
    return callback(null, ReHandler.fail(checkAttError))
  }
  let { buId, apiKey, startTime, endTime, userName, lastTime, gameId } = requestParams
  let pageSize = +requestParams.pageSize || 20
  if (endTime - startTime > 7 * 24 * 60 * 60 * 1000) {
    return callback(null, ReHandler.fail(new CHeraErr(CODES.timeLimitError)))
  }

  if (startTime >= endTime || startTime >= lastTime) {
    return callback(null, ReHandler.fail(new CHeraErr(CODES.timeError)));
  }
  //检查商户信息是否正确
  const merchant = new MerchantModel()
  const [queryMerchantError, merchantInfo] = await merchant.findById(+buId)
  if (queryMerchantError) return callback(null, ReHandler.fail(queryMerchantError))
  if (!merchantInfo || !Object.is(merchantInfo.apiKey, apiKey)) {
    return callback(null, ReHandler.fail(new CHeraErr(CODES.merchantNotExist)))
  }
  let parentId = merchantInfo.userId
  if (merchantInfo.suffix && userName) {
    userName = merchantInfo.suffix + "_" + userName
  }
  let gameRecordModel = new GameRecordModel()
  let [pageErr, page] = await gameRecordModel.page(pageSize, parentId, userName, gameId, startTime, endTime, lastTime)
  if (pageErr) {
    return callback(null, ReHandler.fail(pageErr))
  }
  callback(null, ReHandler.success({ page }))
}

export {
  getPlayerGameRecord //获取玩家游戏战绩（旧）
}
