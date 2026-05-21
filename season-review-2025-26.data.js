const valueBandData=[
{"band":"💰💰💰","label":"Strong positive value","selections":242,"wins":90,"strike_rate":0.3719,"bookmaker_pl":-4.9,"bookmaker_roi":-0.002,"betfair_close_pl_after_commission":91.414,"betfair_close_roi_after_commission":0.0378},
{"band":"💰💰","label":"Medium positive value","selections":680,"wins":271,"strike_rate":0.3985,"bookmaker_pl":-531.6,"bookmaker_roi":-0.0782,"betfair_close_pl_after_commission":-349.928,"betfair_close_roi_after_commission":-0.0515},
{"band":"💰","label":"Small positive value","selections":1198,"wins":576,"strike_rate":0.4808,"bookmaker_pl":-169.7,"bookmaker_roi":-0.0142,"betfair_close_pl_after_commission":97.864,"betfair_close_roi_after_commission":0.0082},
{"band":"❌","label":"Small negative value","selections":1253,"wins":655,"strike_rate":0.5227,"bookmaker_pl":-486.6,"bookmaker_roi":-0.0388,"betfair_close_pl_after_commission":-238.866,"betfair_close_roi_after_commission":-0.0191},
{"band":"❌❌","label":"Medium negative value","selections":790,"wins":437,"strike_rate":0.5532,"bookmaker_pl":-426.2,"bookmaker_roi":-0.0539,"betfair_close_pl_after_commission":-279.928,"betfair_close_roi_after_commission":-0.0354},
{"band":"❌❌❌","label":"Strong negative value","selections":316,"wins":200,"strike_rate":0.6329,"bookmaker_pl":74.9,"bookmaker_roi":0.0237,"betfair_close_pl_after_commission":132.62,"betfair_close_roi_after_commission":0.042}
];
const probabilityBandData=[{"probability_band":"Under 40%","selections":596,"wins":233,"strike_rate":0.3909,"bookmaker_pl":-56.9,"bookmaker_roi":-0.0095,"betfair_close_pl_after_commission":152.31,"betfair_close_roi_after_commission":0.0256},{"probability_band":"40–50%","selections":1843,"wins":799,"strike_rate":0.4335,"bookmaker_pl":-735.4,"bookmaker_roi":-0.0399,"betfair_close_pl_after_commission":-315.326,"betfair_close_roi_after_commission":-0.0171},{"probability_band":"50–60%","selections":1178,"wins":599,"strike_rate":0.5085,"bookmaker_pl":-709.3,"bookmaker_roi":-0.0602,"betfair_close_pl_after_commission":-506.33,"betfair_close_roi_after_commission":-0.043},{"probability_band":"60–70%","selections":570,"wins":363,"strike_rate":0.6368,"bookmaker_pl":-133.6,"bookmaker_roi":-0.0234,"betfair_close_pl_after_commission":-28.856,"betfair_close_roi_after_commission":-0.0051},{"probability_band":"70%+","selections":292,"wins":235,"strike_rate":0.8048,"bookmaker_pl":91.1,"bookmaker_roi":0.0312,"betfair_close_pl_after_commission":151.378,"betfair_close_roi_after_commission":0.0518}];
const strategyData=[{"strategy":"All predictions","selections":4479,"wins":2229,"strike_rate":0.4977,"bookmaker_pl":-1544.1,"bookmaker_roi":-0.0345,"betfair_close_pl_after_commission":-546.824,"betfair_close_roi_after_commission":-0.0122},{"strategy":"Positive value only","selections":2120,"wins":937,"strike_rate":0.442,"bookmaker_pl":-706.2,"bookmaker_roi":-0.0333,"betfair_close_pl_after_commission":-160.65,"betfair_close_roi_after_commission":-0.0076},{"strategy":"Strong positive value only","selections":242,"wins":90,"strike_rate":0.3719,"bookmaker_pl":-4.9,"bookmaker_roi":-0.002,"betfair_close_pl_after_commission":91.414,"betfair_close_roi_after_commission":0.0378},{"strategy":"Positive value + 70%+ model probability","selections":102,"wins":79,"strike_rate":0.7745,"bookmaker_pl":81.8,"bookmaker_roi":0.0802,"betfair_close_pl_after_commission":105.258,"betfair_close_roi_after_commission":0.1032},{"strategy":"All predictions + 70%+ model probability","selections":292,"wins":235,"strike_rate":0.8048,"bookmaker_pl":91.1,"bookmaker_roi":0.0312,"betfair_close_pl_after_commission":151.378,"betfair_close_roi_after_commission":0.0518}];
const predictionTypeData=[{"prediction":"HOME WIN","selections":2954,"wins":1542,"strike_rate":0.522,"bookmaker_pl":-1052.8,"bookmaker_roi":-0.0356,"betfair_close_pl_after_commission":-424.892,"betfair_close_roi_after_commission":-0.0144},{"prediction":"AWAY WIN","selections":1510,"wins":683,"strike_rate":0.4523,"bookmaker_pl":-464.9,"bookmaker_roi":-0.0308,"betfair_close_pl_after_commission":-98.662,"betfair_close_roi_after_commission":-0.0065},{"prediction":"DRAW","selections":15,"wins":4,"strike_rate":0.2667,"bookmaker_pl":-26.4,"bookmaker_roi":-0.176,"betfair_close_pl_after_commission":-23.27,"betfair_close_roi_after_commission":-0.1551}];
const weeklyDataCsv=`week,series,selections,bookmaker_pl,betfair_pl_after_commission
1,All predictions,103,-184.3,-157.92
2,All predictions,108,-110.7,-76.58
3,All predictions,29,17.9,27.87
4,All predictions,94,72.0,107.73
5,All predictions,131,18.2,69.12
6,All predictions,136,-115.9,-105.25
7,All predictions,140,30.6,71.86
8,All predictions,29,-116.2,-112.29
9,All predictions,128,11.8,63.33
10,All predictions,139,146.7,164.19
11,All predictions,117,-2.1,23.21
12,All predictions,138,-38.9,-6.16
13,All predictions,28,5.2,16.9
14,All predictions,130,-8.0,34.72
15,All predictions,130,19.0,58.56
16,All predictions,117,144.6,183.73
17,All predictions,139,43.6,89.22
18,All predictions,117,-17.5,21.51
19,All predictions,37,-5.5,5.9
20,All predictions,34,-46.7,-39.17
21,All predictions,38,-8.4,1.49
22,All predictions,87,-90.4,-85.35
23,All predictions,62,-59.8,-60.21
24,All predictions,141,-98.3,-60.95
25,All predictions,139,5.7,13.07
26,All predictions,140,30.0,77.15
27,All predictions,137,-94.8,-64.16
28,All predictions,118,62.0,86.71
29,All predictions,141,-170.3,-144.35
30,All predictions,141,-95.4,-55.86
31,All predictions,127,-254.6,-230.49
32,All predictions,138,-238.1,-197.59
33,All predictions,139,147.4,168.42
34,All predictions,26,7.4,16.9
35,All predictions,33,-65.3,-55.45
36,All predictions,128,-25.1,-52.68
37,All predictions,137,-73.4,-28.21
38,All predictions,121,-68.1,-31.41
39,All predictions,133,10.0,-2.2
40,All predictions,141,-162.6,-174.15
41,All predictions,105,-52.1,-14.61
42,All predictions,83,-113.7,-93.37
1,Positive value only,46,-72.0,-59.31
2,Positive value only,46,-22.7,-4.91
3,Positive value only,12,-7.6,-6.01
42,Positive value only,28,41.5,53.16
1,💰,22,-51.3,-46.8
2,💰,24,-44.5,-34.07
42,💰,15,28.0,32.9
1,💰💰,14,-46.5,-44.63
2,💰💰,16,-33.2,-26.79
42,💰💰,10,13.5,17.72
1,💰💰💰,10,25.8,32.12
2,💰💰💰,6,55.0,55.95
42,💰💰💰,3,0.0,2.54
1,Negative value only,57,-112.3,-98.61
2,Negative value only,62,-88.0,-71.67
42,Negative value only,55,-155.2,-146.53
1,Positive value + 70%+ model probability,4,-24.8,-24.32
2,Positive value + 70%+ model probability,1,5.0,5.59
42,Positive value + 70%+ model probability,1,3.3,3.63`;
const weeklyData=weeklyDataCsv.trim().split('\n').slice(1).map(l=>{const [week,series,selections,bookmaker_pl,betfair_pl_after_commission]=l.split(',');return{week:+week,series,selections:+selections,bookmaker_pl:+bookmaker_pl,betfair_pl_after_commission:+betfair_pl_after_commission};});
