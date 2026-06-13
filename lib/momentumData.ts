export type MomentumTickerSeed = {
  symbol: string;
  genre: string;
};

export type MomentumMonthlyRow = {
  date: string;
  prices: Record<string, number>;
};

export const MOMENTUM_TICKERS: MomentumTickerSeed[] = [{"symbol":"TQQQ","genre":"Nasdaq Beta"},{"symbol":"SOXL","genre":"AI Semi"},{"symbol":"NVDL","genre":"AI Semi"},{"symbol":"CLSK","genre":"Crypto"},{"symbol":"RKLB","genre":"Space"},{"symbol":"LUNR","genre":"Space"},{"symbol":"IONQ","genre":"Quantum"},{"symbol":"RGTI","genre":"Quantum"},{"symbol":"QBTS","genre":"Quantum"},{"symbol":"UPST","genre":"AI Fintech"},{"symbol":"AFRM","genre":"AI Fintech"},{"symbol":"APP","genre":"AI Application"},{"symbol":"QQQ","genre":"Nasdaq Beta"},{"symbol":"AVAV","genre":"Defense"},{"symbol":"KTOS","genre":"Defense"},{"symbol":"RCAT","genre":"Defense"},{"symbol":"BE","genre":"Nuclear"},{"symbol":"PLTR","genre":"Defense AI"},{"symbol":"CRWD","genre":"Cybersecurity"},{"symbol":"DDOG","genre":"AI Infrastructure"},{"symbol":"NET","genre":"AI Infrastructure"},{"symbol":"SYM","genre":"Robotics"},{"symbol":"NVDA","genre":"AI Semi"},{"symbol":"OKLO","genre":"Nuclear"},{"symbol":"PANW","genre":"Cybersecurity"},{"symbol":"MSTR","genre":"Crypto"},{"symbol":"COIN","genre":"Crypto"},{"symbol":"RIOT","genre":"Crypto"},{"symbol":"ASTS","genre":"Space"},{"symbol":"VRT","genre":"AI Infrastructure"},{"symbol":"BBAI","genre":"Defense AI"},{"symbol":"MOD","genre":"Energy Infrastructure"},{"symbol":"PWR","genre":"Energy Infrastructure"},{"symbol":"SERV","genre":"Robotics"},{"symbol":"S","genre":"Cybersecurity"},{"symbol":"MU","genre":"AI Memory"},{"symbol":"FN","genre":"Optical Networking"},{"symbol":"LITE","genre":"Optical Networking"}];

export const MOMENTUM_CANDIDATE_SUGGESTIONS: MomentumTickerSeed[] = [{"symbol":"CGNX","genre":"Machine Vision"},{"symbol":"FN","genre":"Optical Networking"},{"symbol":"LITE","genre":"Optical Networking"},{"symbol":"ROK","genre":"Industrial Automation"},{"symbol":"SMCI","genre":"AI Server"},{"symbol":"CIEN","genre":"Optical Networking"},{"symbol":"SKYT","genre":"AI Connectivity"},{"symbol":"HPE","genre":"AI Infrastructure"},{"symbol":"TER","genre":"AI Manufacturing"}];

export const MOMENTUM_MONTHLY_ROWS: MomentumMonthlyRow[] = [];
