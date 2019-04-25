// ：{"p":[{"m":"C","n":12},{"m":"C","n":3},{"m":"S","n":1}],"result":"1007","bpresult":0,"b":[{"m":"D","n":12},{"m":"D","n":7}],"betnums":2}
// p 闲牌形 b 庄牌形 最多3张牌
// m:'H':'红桃','D':'方块','C':'梅花','S':'黑桃'
// n: 1-13  1表示A   13 表示K
// bpresult 该局结果  0庄 1闲 2和 3 庄、庄对 4 庄、闲对 5 和、庄对 6 和、闲对 7闲、庄对 8 闲、闲对 9庄、庄对、闲对  10 和、庄对、闲对 11 闲、庄对、闲对
// result 位数
//  *	1  	 	1庄 2闲 3和    点数输赢
//  *	2		0无  1庄例牌  2闲例牌   3庄闲例牌
//  *	3 		0无  1庄对  2闲对  3庄闲对
//  *	4 		庄点数
// betnums 靴数
module.exports = {
    // 对外查询分页
    buildNewPageRows: function (page) {
        page.list = page.list.map((record) => {
            let baseObj = {
                userId: record.userId,
                userName: record.userName.slice(record.userName.indexOf('_') + 1),
                gameType: record.gameType.toString(),
                gameId: record.gameId,
                betId: record.betId,
                betTime: record.betTime,
            }
            return { ...baseObj, ...getOtherObj(record) }
        })
        page.list = page.list.filter((record) => {
            return record.gameType != '1070000' || record.settleTime
        })
        page.pageSize = page.list.length
    },
    // 对内查询单条
    buildOnePageRows: function (record) {
        let baseObj = {
            userId: record.userId,
            userName: record.userName,
            gameType: record.gameType.toString(),
            gameId: record.gameId,
            betId: record.betId,
            betTime: record.betTime,
        }
        return { ...baseObj, ...getOtherObj(record) }
    }
}
// 获取统一战绩对象
function getOtherObj(record) {
    let gameType = record.gameType
    let otherObj = {}
    if (gameType == "40000" || gameType == "70000" || gameType == "90000") {  //NA电子
        let gameDetail = JSON.parse(record.gameDetail)        //record字段存储第三方游戏的战绩，但NA电子游戏的战绩在record.gameDetail里面
        otherObj = {
            gameName: "NA电子游戏",
            preBalance: gameDetail.preBalance,
            betAmount: gameDetail.bet,
            winAmount: gameDetail.totalGold,
            refundAmount: 0,
            retAmount: gameDetail.totalGold,
            winloseAmount: parseFloat((gameDetail.totalGold - gameDetail.bet).toFixed(2)),
            mixAmount: gameDetail.bet,
            betCount: 1,
            roundResult: gameDetail,
            settleTime: record.betTime
        }
    } else if (gameType == "1050000") { //AG真人
        let firstBet = ((record.content || {}).bet || [{ originalAmount: 0 }])[0]  //第一条下注
        let firstRet = ((record.content || {}).ret || [{ anotherGameData: {} }])[0]//第一条返还
        let anotherGameData = firstRet ? firstRet.anotherGameData : firstBet.anotherGameData
        if (anotherGameData == 'NULL!') {
            anotherGameData = {}
        } else {
            anotherGameData = JSON.parse(anotherGameData)
        }
        let betObj = getContentBetObj(record)
        let retObj = getContentRetObj(record)
        otherObj = {
            gameName: betObj.gameName,
            preBalance: firstBet.originalAmount,
            betDetail: { betName: betObj.betName },
            betAmount: betObj.betAmount,
            winAmount: retObj.winAmount,
            refundAmount: retObj.refundAmount,
            retAmount: retObj.retAmount,
            winloseAmount: parseFloat((retObj.retAmount - betObj.betAmount).toFixed(2)),
            betCount: betObj.count,
            roundId: betObj.roundId,
            settleTime: retObj.settleTime,
            roundResult: anotherGameData.gameResult ? setAGResult(anotherGameData.gameResult) : {}
        }
        otherObj.mixAmount = Math.min(Math.abs(otherObj.betAmount), Math.abs(otherObj.winloseAmount))
    } else if (gameType == "1060000") { //SA真人,anotherGameData{data:[{\"GameResult\":[{\"BaccaratResult\":[]}]}],mixAmount:0}
        let betObj = getContentBetObj(record)
        let retObj = getContentRetObj(record)
        if (retObj.refundAmount > 0 && retObj.refundAmount == betObj.betAmount) {  // 退款金额和下注金额一致，则设置默认战绩
            record.anotherGameData = { data: '[{\"GameResult\":[{\"BaccaratResult\":[]}]}]', mixAmount: 0 }
        }
        if (!record.anotherGameData || record.anotherGameData == 'NULL!') {        // SA查询没有战绩，则设置默认战绩
            record.anotherGameData = { data: '[{\"GameResult\":[{\"BaccaratResult\":[]}]}]', mixAmount: 0 }
        }
        let item = JSON.parse((record.anotherGameData || { data: "{}" }).data)
        item = (item || [])[0]
        otherObj = {
            gameName: (item.HostName || [])[0],
            preBalance: betObj.preBalance,
            betAmount: betObj.betAmount,
            winAmount: retObj.winAmount,
            refundAmount: retObj.refundAmount,
            retAmount: retObj.retAmount,
            winloseAmount: parseFloat((retObj.retAmount - betObj.betAmount).toFixed(2)),
            mixAmount: record.anotherGameData.mixAmount || 0,
            betCount: betObj.count,
            roundId: (item.Round || [])[0],
            roundResult: setSAResult(item.GameResult),
            settleTime: retObj.settleTime
        }
    } else if (gameType == "1130000") { //YSB体育
        let item = JSON.parse(record.anotherGameData || "{}")
        let betObj = getContentBetObj(record)
        let retObj = getContentRetObj(record)
        otherObj = {
            gameName: "YSB体育游戏",
            preBalance: betObj.preBalance,
            settleRate: item.ODDS,
            betDetail: item,
            betAmount: betObj.betAmount,
            winAmount: retObj.winAmount,
            refundAmount: retObj.refundAmount,
            retAmount: retObj.retAmount,
            winloseAmount: parseFloat((retObj.retAmount - betObj.betAmount).toFixed(2)),
            mixAmount: betObj.betAmount,
            betCount: betObj.count,
            roundResult: {},
            settleTime: retObj.settleTime,
            oddsStyle: item.ODDFORMAT
        }
    } else if (gameType == "1070000") { //开元棋牌
        let betObj = record.anotherGameData
        if (betObj == 'NULL!') {
            return {}
        }
        otherObj = {
            gameName: "开元棋牌游戏",
            preBalance: 0,
            betAmount: +betObj.AllBet,
            winAmount: parseFloat((+betObj.AllBet + +betObj.Profit).toFixed(2)),
            refundAmount: 0,
            retAmount: parseFloat(+(+betObj.AllBet + +betObj.Profit).toFixed(2)),
            winloseAmount: +betObj.Profit,
            mixAmount: +betObj.CellScore,
            betCount: 1
        }
        delete betObj.Accounts
        delete betObj.AllBet
        delete betObj.CellScore
        delete betObj.Profit
        otherObj.roundResult = betObj
    } else {                            //其他第三方游戏
        let betObj = getContentBetObj(record)
        let retObj = getContentRetObj(record)
        otherObj = {
            preBalance: record.preBalance || betObj.preBalance,
            betAmount: -record.amount || betObj.betAmount,
            winAmount: retObj.winAmount,
            refundAmount: retObj.refundAmount,
            retAmount: retObj.retAmount,
            winloseAmount: parseFloat((retObj.retAmount - betObj.betAmount).toFixed(2)),
            settleTime: retObj.settleTime,
            mixAmount: betObj.betAmount,
            betCount: betObj.count,
            roundResult: {}
        }
    }
    if (gameType == '1120000') { //SB真人
        otherObj.mixAmount = Math.min(Math.abs(otherObj.betAmount), Math.abs(otherObj.winloseAmount))
    }
    // 输赢和状态判断
    if (otherObj.retAmount < otherObj.betAmount) {
        otherObj.roundStatus = 1 // 输
    } else if (otherObj.retAmount > otherObj.betAmount) {
        otherObj.roundStatus = 2 // 赢
    } else if (otherObj.retAmount == otherObj.betAmount) {
        otherObj.roundStatus = 3 // 和
    }
    if (otherObj.refundAmount > 0 && otherObj.retAmount == otherObj.refundAmount && otherObj.retAmount == otherObj.betAmount) {
        otherObj.roundStatus = 0 // 取消
    }
    // 可选投注IP
    otherObj.sourceIP = record.sourceIP
    // 可选下注详情
    otherObj.betDetail = otherObj.betDetail || {}
    // 可选赔率
    otherObj.settleRate = otherObj.settleRate
    // 可选游戏名称
    otherObj.gameName = otherObj.gameName || record.gameType.toString()
    // 可选结算时间
    otherObj.settleTime = otherObj.settleTime || record.createdAt
    // 可选局号
    otherObj.roundId = otherObj.roundId
    return otherObj
}

// 获取统一下注对象
function getContentBetObj(record) {
    let betList = (record.content || { bet: [] }).bet || []
    let betObj = { preBalance: 0, betAmount: 0, count: 0 }
    for (let bet of betList) {
        if (bet.originalAmount > betObj.preBalance) {
            betObj.preBalance = bet.originalAmount
        }
        betObj.count++
        betObj.betAmount += Math.abs(bet.amount)
    }
    betObj.betAmount = parseFloat(betObj.betAmount.toFixed(2))
    //AG下注对象特殊处理
    if (record.gameType == "1050000") { // AG真人
        let betList = (record.anotherGameData || { bet: [], ret: [] }).bet
        betObj.betName = ""
        for (let betJson of betList) {
            let bet = JSON.parse(betJson)
            // agBetObj.betTime = new Date(bet.betTime) - 8 * 60 * 60 * 1000
            betObj.roundId = bet.roundId
            betObj.gameName = bet.gametype == "BAC" ? "百家乐" : bet.gametype
            betObj.gameTable = bet.tableCode
            betObj.betName += getAGBet(bet) // 累加每次下注详情
        }
    }
    return betObj
}

// 获取统一返还对象
function getContentRetObj(record) {
    let retList = (record.content || { ret: [] }).ret || [];
    let retObj = {
        winAmount: 0,
        refundAmount: 0,
        retAmount: 0,
        settleTime: 0
    }
    for (let i = 0; i < retList.length; i++) {
        let ret = retList[i];
        ret.type == 4 ? retObj.winAmount += ret.amount : null
        ret.type == 5 ? retObj.refundAmount += ret.amount : null
        retObj.retAmount += ret.amount
        retObj.settleTime = ret.createdAt || 0
    }
    retObj.winAmount = parseFloat(retObj.winAmount.toFixed(2))
    retObj.refundAmount = parseFloat(retObj.refundAmount.toFixed(2))
    retObj.retAmount = parseFloat(retObj.retAmount.toFixed(2))
    return retObj
}

// 获取AG下注详情
function getAGBet(bet) {
    let str = "";
    if (bet.playtype == 1) {
        str = "庄:"
    } else if (bet.playtype == 2) {
        str = "闲:"
    } else if (bet.playtype == 3) {
        str = "和:"
    } else if (bet.playtype == 4) {
        str = "庄对:"
    } else if (bet.playtype == 5) {
        str = "闲对:"
    } else if (bet.playtype == 6) {
        str = "大:"
    } else if (bet.playtype == 7) {
        str = "小:"
    } else if (bet.playtype == 11) {
        str = "庄免佣:"
    } else if (bet.playtype == 12) {
        str = "庄龙宝:"
    } else if (bet.playtype == 13) {
        str = "闲龙宝:"
    } else if (bet.playtype == 14) {
        str = "超级六:"
    } else if (bet.playtype == 15) {
        str = "任意对子:"
    } else if (bet.playtype == 16) {
        str = "完美对子:"
    } else {
        str = "其他:"
    }
    str += bet.value + ","
    return str;
}

// 设置AG真人战绩
// P;DA;DJ;H8:B;D6;C5;H10  
// roundResult:'{\"p\":[{\"m\":\"S\",\"n\":4},{\"m\":\"D\",\"n\":12}],\"result\":\"1118\",\"bpresult\":3,\"b\":[{\"m\":\"S\",\"n\":4},{\"m\":\"C\",\"n\":4}],\"betnums\":2}',
// p 闲牌形 b 庄牌形 最多3张牌
// m:'H':'红桃','D':'方块','C':'梅花','S':'黑桃'
// n: 1-13  1表示A   13 表示K
function setAGResult(gameResult) {
    let paiObj = { p: [], b: [] }
    let words = gameResult.split(":");
    let p = words[0].split(";");
    let b = (words[1] || "").split(";")
    for (let i = 1; i < p.length; i++) {
        let huase = p[i].substring(0, 1);
        let pai = p[i].substring(1, p[i].length);
        paiObj.p.push({ m: huase, n: pai })
    }
    for (let i = 1; i < b.length; i++) {
        let huase = b[i].substring(0, 1);
        let pai = b[i].substring(1, b[i].length);
        paiObj.b.push({ m: huase, n: pai })
    }
    return JSON.stringify(paiObj)
}

// 获取SA真人战绩
function setSAResult(gameResult) {
    gameResult = (gameResult || [])[0].BaccaratResult;
    gameResult = gameResult || [];
    let obj = {
        "p": [],
        "b": [],
        "bpresult": "",
        "result": "",
        "betnums": ""
    }
    for (let i = 0; i < gameResult.length; i++) {
        let result = gameResult[0];
        let playerCard1 = (result.PlayerCard1 || [])[0];
        let playerCard2 = (result.PlayerCard2 || [])[0];
        let playerCard3 = (result.PlayerCard3 || [])[0];
        let zhuangCard1 = (result.BankerCard1 || [])[0];
        let zhuangCard2 = (result.BankerCard2 || [])[0];
        let zhuangCard3 = (result.BankerCard3 || [])[0];
        if (playerCard1) {
            obj.p[0] = {
                m: huase((playerCard1.Suit || [])[0]),
                n: (playerCard1.Rank || [])[0]
            }
        }
        if (playerCard2) {
            obj.p[1] = {
                m: huase((playerCard2.Suit || [])[0]),
                n: (playerCard2.Rank || [])[0]
            }
        }
        if (playerCard3) {
            obj.p[2] = {
                m: huase((playerCard3.Suit || [])[0]),
                n: (playerCard3.Rank || [])[0]
            }
        }
        if (zhuangCard1) {
            obj.b[0] = {
                m: huase((zhuangCard1.Suit || [])[0]),
                n: (zhuangCard1.Rank || [])[0]
            }
        }
        if (zhuangCard2) {
            obj.b[1] = {
                m: huase((zhuangCard2.Suit || [])[0]),
                n: (zhuangCard2.Rank || [])[0]
            }
        }
        if (zhuangCard3) {
            obj.b[2] = {
                m: huase((zhuangCard3.Suit || [])[0]),
                n: (zhuangCard3.Rank || [])[0]
            }
        }
    }
    return JSON.stringify(obj);
    function huase(n) {
        if (n == 1) {
            return "S"
        }
        if (n == 2) {
            return "H"
        }
        if (n == 3) {
            return "C"
        }
        return "D"
    }
}

// AG淘汰方法
// function buildBetObj() {
//     let betList = record.bet || [];
//     let obj = { betAmount: 0, itemName: "", count: betList.length, preBalance: 0 }
//     for (let i = 0; i < betList.length; i++) {
//         let bet = JSON.parse(betList[i])
//         obj.betAmount += +bet.value || 0;
//         obj.betTime = new Date(bet.betTime) - 8 * 60 * 60 * 1000
//         obj.roundId = bet.roundId;
//         obj.itemName = obj.itemName + getAGBet(bet)
//         obj.gameName = bet.gametype == "BAC" ? "百家乐" : bet.gametype
//         obj.gameTable = bet.tableCode;
//     }
//     return obj
// }
// function buildRetObj() {
//     let retList = record.ret || [];
//     let obj = { retAmount: 0, itemName: "", validAmount: 0 }
//     for (let i = 0; i < retList.length; i++) {
//         let ret = JSON.parse(retList[i])
//         obj.validAmount += +ret.validBetAmount;
//         obj.retAmount += ((+ret.validBetAmount) + (+ret.netAmount)) || 0
//         obj.roundResult = setGameResult(ret.gameResult || "")
//         obj.settletime = new Date(ret.settletime || 0) - 8 * 60 * 60 * 1000
//     }
// return obj
// }