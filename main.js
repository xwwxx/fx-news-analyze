/**
 * Created by 玮 on 2015/3/18.
 */

var Promise = require("bluebird");
var request = Promise.promisify(require('request'));
var cheerio = require('cheerio');
var querystring = require('querystring');
var program = require('commander');
var _ = require('lodash');

/**
 * 取得经济日历数据
 * @param startData
 * @param endDate
 * @param countryCode
 * @returns {*}
 */
function getData(startData, endDate, countryCode) {
    var url = 'http://calendar.fxstreet.com/EventDateWidget/GetMain?f=jsonhtml&callback=jQuery172044270164938643575_1426605666197&timezone=China%2BStandard%2BTime&rows=0&view=range&volatility=0&culture=zh-CN&columns=None&_=1426695486101';
    var param = {
        start: startData, // '20150411', // 开始时间
        end: endDate, //'20150411', // 结束时间
        countrycode: countryCode //'US' // 国家码
    };

    return request(url + '&' + querystring.stringify(param), {
        headers: {
            'Referer': 'http://www.forex.com/uk/cns/forex_eco_cal.html'
        }
    })
    .then(function(data) {
        var content = data[1];
        content = content.replace(/^jQuery\d+_\d+\(/, '').replace(/\);$/, '');
        var $htmlDom = cheerio.load(JSON.parse(content).Html);
        var trItems = $htmlDom('tr', 'tbody');
        var results = [];
        for (var i = 0; i < trItems.length; i++) {
            var trItem = trItems.eq(i);

            if (trItem.hasClass('fxst-dateRow')) {  // 时间行 新增新item
                results.push({
                    date: trItem.text(),
                    countryCode: countryCode
                });
            } else if (trItem.hasClass('fxit-eventrow')) { // 事件行
                var tdItems = trItem.find('td');
                results[results.length - 1].items = results[results.length - 1].items || [];
                var itemKeys = ['time', 'countryCode', 'event', 'attention', 'actualValue', 'expectedValue', 'preValue']; // 时间， 国家码， 事件， 市场关注度，实际值，预期值，前值
                var item = {};
                for (var j = 0; j < tdItems.length; j++) {
                    if (itemKeys[j]) {
                        item[itemKeys[j]] = tdItems.eq(j).text();
                        if (itemKeys[j] == 'actualValue') {
                            if (tdItems.eq(j).hasClass('fxst-better')) {
                                item['isBetterThanExpected'] = 1; // 1表示好于预期
                            } else if (tdItems.eq(j).hasClass('fxst-worst')) {
                                item['isBetterThanExpected'] = -1; // -1表示逊于预期
                            } else {
                                item['isBetterThanExpected'] = 0; // 0表示没有预期
                            }
                        }
                    }
                }
                results[results.length - 1].items.push(item);
            }
        }
        return results;
    })
    .catch(function(e) {
        console.error(e);
    });
}

/**
 * 分析经济日历数据
 * 返回值　1:看多　-1:看空 0:震荡
 */
function analysisData(ondDayData) {
    //console.log(ondDayData);

    // 先按关注度进行分组
    var result = _.groupBy(ondDayData.items, function(item) {
        return item.attention;
    });

    // 再按预期比较分组
    _.each(result, function(items, attention) {
        result[attention] = _.groupBy(items, function(item) {
            return item.isBetterThanExpected;
        });
    });

    // 1. 先分析市场关注度最高的经济指标，如果比预期好的指标数多于比预期坏的指标数，指看多；反多看空
    if (result['3']) {
        var betterIndexLength = result['3']['1'] ? result['3']['1'].length : 0;
        var worstIndexLength = result['3']['-1'] ? result['3']['-1'].length : 0;
        if (betterIndexLength != worstIndexLength) {
            return betterIndexLength > worstIndexLength ? 1 : -1;
        }
    }
    // 2. 如果没有关注度最高的经济指标，则比较关注度次之的经济指标
    if (result['2']) {
        var betterIndexLength = result['2']['1'] ? result['2']['1'].length : 0;
        var worstIndexLength = result['2']['-1'] ? result['2']['-1'].length : 0;
        if (betterIndexLength != worstIndexLength) {
            return betterIndexLength > worstIndexLength ? 1 : -1;
        }
    }
    // 3. 如果没有关注度次之的经济指标，则比较关注度最低的经济指标
    if (result['1']) {
        var betterIndexLength = result['1']['1'] ? result['1']['1'].length : 0;
        var worstIndexLength = result['1']['-1'] ? result['1']['-1'].length : 0;
        if (betterIndexLength != worstIndexLength) {
            return betterIndexLength > worstIndexLength ? 1 : -1;
        }
    }

    return 0;
}

function start() {

    var currencyPairs = [
        {
            name: 'USDJPY',
            countryCodes: ['US', 'JP']
        },
        {
            name: 'USDCAD',
            countryCodes: ['US', 'CA']
        },
        {
            name: 'USDCHF',
            countryCodes: ['US', 'CH']
        },
        {
            name: 'GBPUSD',
            countryCodes: ['UK', 'US']
        },
        {
            name: 'AUDUSD',
            countryCodes: ['AU', 'US']
        }
    ];
    var countryCodes = ['US', 'JP', 'CA', 'UK', 'AU', 'CH'];
    var startDate = '20150828',
        endDate = startDate;

    var promises = [];
    _.each(countryCodes, function(countryCode) {
        promises.push(getData(startDate, endDate, countryCode));
    });

    var analysisResults = [];
    Promise.all(promises).then(function(datas) {
        _.each(datas, function(data) {
            if (data && data.length > 0) {
                var analysisResult = analysisData(data[0]);
                analysisResults.push({
                    countryCode: data[0].countryCode,
                    result: analysisResult
                })
            }
        });

        console.log(analysisResults);

        _.each(currencyPairs, function(currencyPair) {
            // TODO Daniel: 最终得出货币对是看空还是看多
        });

    })
}

start();


function main() {
}

main();



