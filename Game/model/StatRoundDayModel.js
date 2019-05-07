const { Tables, RoleCodeEnum } = require('../lib/Dynamo')
const BaseModel = require('./BaseModel')
const moment = require('moment')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const _ = require('lodash')

module.exports = class StatRoundDayModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.StatRoundDay,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 统计局表每一天的写入局天表
     * inparam.isInit 是否全部初始
     */
    async cronRoundDay(inparam = {}) {
        // 非重置情况下，如果今天是周一，则去更新一周的数据
        if (!inparam.isInit && moment().utcOffset(8).weekday() == 1) {
            return await this.mondayProcess(inparam)
        }
        // 非重置情况下，如果今天非周一，则去更新至今的数据
        if (!inparam.isInit && moment().utcOffset(8).weekday() != 1) {
            return await this.roundDayProcess(inparam)
        }
    }

    // 周一特殊处理
    async mondayProcess(inparam) {
        let mondayTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        let sundayTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        inparam.updateDay = parseInt(moment(mondayTime).utcOffset(8).format('YYYYMMDD'))                                    // 重置时间为上周一
        inparam.start = new Date(`${moment(mondayTime).utcOffset(8).format('YYYY-MM-DD')}T00:00:00+08:00`).getTime()        // 上周一0点
        inparam.end = new Date(`${moment(sundayTime).utcOffset(8).format('YYYY-MM-DD')}T23:59:59+08:00`).getTime() + 999    // 上周日结束
        console.log(`全周重置，参数：${JSON.stringify(inparam)}，${moment(inparam.start).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${moment(inparam.end).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}`)
        let tokenAdmin = await jwt.sign({
            role: RoleCodeEnum.PlatformAdmin,
            exp: Math.floor(Date.now() / 1000) + 86400
        }, process.env.TOKEN_SECRET)
        axios.post(`https://${process.env.ANOTHER_GAME_CENTER}/stat/fixRound`, inparam, {
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        }).then(res => {
            console.log(res.data)
        }).catch(err => {
            console.error(err)
        })
        return [false, inparam.updateDay]
    }

    // 非周一更新天表至今
    async roundDayProcess(inparam) {
        let updateDay = parseInt(moment().utcOffset(8).startOf('isoWeek').format('YYYYMMDD'))                                  // 重置时间为上周一
        console.log(`全周更新，起始：${updateDay}`)
        let tokenAdmin = await jwt.sign({
            role: RoleCodeEnum.PlatformAdmin,
            exp: Math.floor(Date.now() / 1000) + 86400
        }, process.env.TOKEN_SECRET)
        axios.post(`https://${process.env.ANOTHER_GAME_CENTER}/stat/fixRoundDay`, { updateDay }, {
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        }).then(res => {
            console.log(res.data)
        }).catch(err => {
            console.error(err)
        })
        return [false, inparam.updateDay]
    }
}


