"use strict";
exports.id = 134;
exports.ids = [134];
exports.modules = {

/***/ 8134:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "n": () => (/* binding */ WalletProvider),
/* harmony export */   "z": () => (/* binding */ WalletContext)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);


const WalletContext = /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)();
// const OPERATOR_ID = '0.0.1013';
// const OPERATOR_KEY = '302e020100300506032b657004220420012bb2dc6f1c116d9251b697ea3acf93fc3648d33ebf9ab6e099fc6426eecfa6';
const WalletProvider = ({ children  })=>{
    const { 0: walletInfo , 1: setWalletInfo  } = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
        privateKey: "302e020100300506032b657004220420012bb2dc6f1c116d9251b697ea3acf93fc3648d33ebf9ab6e099fc6426eecfa6",
        accountId: "0.0.1013",
        network: "testnet",
        topicId: "0.0.7175851",
        submitKey: ""
    });
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx(WalletContext.Provider, {
        value: {
            walletInfo,
            setWalletInfo
        },
        children: children
    });
};


/***/ })

};
;