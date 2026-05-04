import React, {useEffect, useRef, useState} from "react";
import * as XLSX from "xlsx";
import {
    Button,
    ConfigProvider,
    Divider,
    Form,
    InputNumber,
    Layout,
    Menu,
    message,
    Modal,
    Radio,
    Select,
    Space,
    theme,
    Tooltip,
    Checkbox
} from "antd";
import {MoonOutlined, SunOutlined} from "@ant-design/icons";
import {registerAllModules} from 'handsontable/registry';
import {Navigate, Route, Routes, useNavigate} from "react-router-dom";
// import 'katex/dist/katex.min.css';
// import {InlineMath} from "react-katex";
// 导入分出去的组件，即js文件
// ./ 表示 “当前文件所在的目录
import Dashboard from './dashboard'; // 自动找里面前缀是dashboard的文件
import AboutPage from './about';
import {airPassengers_data, iris_data, shampooSales_data, bookstore_data} from './dataset'
import Translate from './translate';

// 注意：如果 import 报错，请使用此路径或在 index.html 引入 CDN
// import 'handsontable/dist/handsontable.full.css';
import './styles/App.css';


registerAllModules(); // handsontable

const {Header, Footer} = Layout;

function App() {
    // navigate 可以控制跳转到其他页面
    const navigate = useNavigate();

    // 初始数据
    const initialData = [
        ['1', 20],
        ['2', 27],
        ['3', 25],
        ['4', 22],
        ['5', 18],
        ['6', 21],
        ['7', 26],
        ['8', 19],
        ['9', 16],
        ['10', 28],
        ['11', 25],
        ['12', 24],
        ['13', 17],
        ['14', 23],
        ['15', 27]
    ];
    // 创建一个能被 React 监测到的数据仓库: 变动的数据集和数据修改函数
    const initialColumns = ['Week', 'Calls'];
    // 转换为 Option 格式
    // 在 JavaScript 的箭头函数中，如果你使用了大括号 { ... }，它被视为一个代码块，你必须明确使用 return 关键字
    const headerToOption = (headers) =>
        headers.map((item, index) => ({label: item, value: index}));

    const DATASET_CONFIG = {
        //第一个参数为key， 这个字典里的key就是下面options里的value
        air: airPassengers_data,
        shampoo: shampooSales_data,
        iris: iris_data,
        bookstore: bookstore_data,
    };
    // 定义 Select dataset 的选项
    // value 给程序员看的，label 给用户看的
    const datasetOptions = [
        {label: 'Monthly bookstore sales', value: 'bookstore'},
        {label: 'Air Passengers (1949-1960)', value: 'air'},
        {label: 'Shampoo Sales (3 Years)', value: 'shampoo'},
        {label: 'Iris data (not time series)', value: 'iris'}
    ];

    // map 第一个参数为当前正在处理的元素，第二个为索引
    const initialColumnOptions = headerToOption(initialColumns);

    const [wasmInstance, setWasmInstance] = useState(null);
    // 右边小括号里是初始值，仅在组件挂载时执行
    const [uiState, setUiState] = useState({
        darkMode: false,
        activeModal: null,
        isCardVisible: false,
        radioPredictOption: null,
        radioChartOption: null,
        checkAppendData: false,
    });
    const [chartConfig, setChartConfig] = useState({
        xAxis: 'default_index',   // 横轴选中的列
        yAxes: [], // 纵轴选中的列（多选）
        isScatter: false,
        scatterYAxes: [],
        featureColumns: [],
    });
    // 不要与上面合并，因为 setPlotResult 可以有很多参数
    const [plotResult, setPlotResult] = useState(null);
    const [tableConfig, setTableConfig] = useState({
        columnOptions: initialColumnOptions,   // 存储列名
        tableData: initialData, // 纵轴选中的列（多选）
        // columns: initialColumnOptions.map(col => ({ data: col.value })),
        selectDataset: 'bookstore'
    });

    // 在 JavaScript 和 React 的 useState 中，所有的键名（Keys）本质上都是字符串
    // 即使你在定义对象时没有写引号，JavaScript 引擎也会自动把它们处理成字符串
    const [params, setParams] = useState({
        k: 3,
        alpha: 0.2,
        beta: 0.2,
        gamma: 0.2,
        n_predict: 1
    });
    const [metrics, setMetrics] = useState({RMSE: null, MAD: null});

    // useEffect(() => {setUiState(prevState => ({...prevState, darkMode: !uiState.darkMode}))}, [uiState.darkMode]);

    // 加载 wasm
    useEffect(() => {
        async function init() {
            // 检查全局变量是否存在（由 public/index.html 中的 <script> 标签注入）
            // 如果你在 emcc 编译时用了 -s EXPORT_NAME="createPredictModule"，这里就改用 window.createPredictModule
            const createModule = window.wasmPredict;

            if (typeof createModule !== 'function') {
                console.error("Wasm 脚本尚未加载，请确保 index.html 中已引入 predict.js");
                return;
            }

            try {
                const wasmModule = await createModule({
                    // 关键点：locateFile 决定了去哪里找 .wasm 文件
                    locateFile: (path) => {
                        if (path.endsWith('.wasm')) {
                            // 直接返回根目录下的文件名
                            // 这个地址容易出错，必须是能下载到wasm文件的那个地址
                            return '/predictor/predict.wasm';
                        }
                        return path;
                    }
                });

                console.log("WASM ready", wasmModule);
                setWasmInstance(wasmModule);
            } catch (e) {
                console.error("Wasm 初始化失败:", e);
            }
        }

        init();
        // [] 表示根据什么变量的变化才生效
    }, []);

    const hotRef = useRef(null);

    // 关闭弹窗的统一方法
    const closeModal = () => setUiState(prevState => ({...prevState, activeModal: null}));

    const handleClearYAxes = () => {
        setChartConfig(prevConfig => ({
            ...prevConfig, // 展开旧状态，保留 xAxis 等其他属性
            yAxes: []      // 将 yAxes 覆盖为空数组
        }));
    };

    // --- 功能逻辑 ---
    const toggleTheme = () => {
        setUiState(prevState => ({...prevState, darkMode: !uiState.darkMode}))
    }

    const resetData = () => {
        // initialData 是你最初定义的那个空数组或默认数组
        // ... 是扩展运算符，将数组拆开再创建一个新数组
        setTableConfig(prevState => ({...prevState, tableData: initialData}));
        setTableConfig(prevState => ({...prevState, columnOptions: initialColumnOptions}));
    };

    // radio 的选择通过这个函数传递出去
    const radioPredictionSelect = (e) => {
        setUiState(prevState => ({...prevState, radioPredictOption: e.target.value}));
    };
    const radioChartSelect = (e) => {
        setUiState(prevState => ({...prevState, radioChartOption: e.target.value}));
    };

    const handleDatasetChange = (key) => {
        const selected = DATASET_CONFIG[key];

        setTableConfig(prevState => ({
            ...prevState,
            tableData: selected.data, // 转换后的对象数组
            columnOptions: headerToOption(selected.columns) // 直接使用 columns
        }));
    };

    const handleDatasetChangeClick = () => {
        setUiState(prevState => ({...prevState, activeModal: 'select-dataset'}));
    }

    const movingAverage = (raw_data, k, n) => {
        if (k > raw_data.length) {
            message.warning('k is too large!');
            return;
        }

        const result = [];
        let windowSum = 0;

        for (let i = 0; i < raw_data.length + n; i++) {
            // 加上当前进入窗口的值
            if (i > 0) {
                if (i < raw_data.length)
                    windowSum += raw_data[i - 1];
                else
                    windowSum += raw_data[raw_data.length - 1];
            }

            // 当索引达到 k-1 时，窗口正式填满，开始计算平均值
            if (i > k - 1) {
                // 计算平均值并推入结果
                result.push((windowSum / k).toFixed(4));

                // 减去即将移出窗口的值（为下一次迭代做准备）
                windowSum -= raw_data[i - k];
            } else {
                // 窗口未满时，可以选择填充 null 或跳过
                result.push(null);
            }
        }
        message.success("Moving average prediction finished");

        // 添加数据到表格里
        if (uiState.checkAppendData === true) {
            // Key 是给计算机看的（身份证），Label 是给用户看的（姓名）。
            const newColKey = `pred_ma_${k}`;
            const columnName = tableConfig.columnOptions[chartConfig.yAxes].label;
            const newColLabel = `MA(${k})-forecast-${columnName}`;

            appendColumn(newColKey, newColLabel, result);
        }
        return result;
    };

    const appendColumn = (newColKey, newColLabel, result) => {
        const updatedTableData = tableConfig.tableData.map((row, index) => ({
            ...row,
            [newColKey]: result[index]
        }));

        // 如果预测结果比原数据多出点，补行
        if (result.length > tableConfig.tableData.length) {
            for (let i = tableConfig.tableData.length; i < result.length; i++) {
                updatedTableData.push({[newColKey]: result[i]});
            }
        }

        setTableConfig(prev => ({
            ...prev,
            tableData: updatedTableData,
            // value：这是逻辑值（通常对应 Key)
            columnOptions: [...prev.columnOptions, {value: newColKey, label: newColLabel}],
        }));
        setUiState(prev => ({...prev, checkAppendData: false}));
    };

    const computeRMSE = (raw_data, predict_data) => {
        const n = raw_data.length;

        let sumSquaredError = 0;

        for (let i = 0; i < n; i++) {
            const actual = parseFloat(raw_data[i]);
            const predicted = parseFloat(predict_data[i]);

            const error = actual - predicted;
            sumSquaredError += error * error;
        }

        const rmse = Math.sqrt(sumSquaredError / n);
        setMetrics(prevState => ({...prevState, RMSE: rmse}));
    };

    const computeMAD = (raw_data, predict_data) => {
        const n = raw_data.length;

        let absoluteError = 0;

        for (let i = 0; i < n; i++) {
            const actual = parseFloat(raw_data[i]);
            const predicted = parseFloat(predict_data[i]);
            absoluteError += Math.abs(actual - predicted);
        }

        const MAD = Math.sqrt(absoluteError / n);
        setMetrics(prevState => ({...prevState, MAD: MAD}));
    };

    const handleImportFileClick = () => {
        // 创建一个隐藏的 input
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".xlsx, .xls, .csv";

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = (evt) => {
                const data = new Uint8Array(evt.target.result);

                // 读取 Excel
                const workbook = XLSX.read(data, {type: "array"});

                // 默认读取第一个 sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // 转成二维数组
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1});

                if (jsonData.length === 0) return;

                // 第一行作为表头
                const headers = jsonData[0];

                // 后面是数据
                const rows = jsonData.slice(1);

                // 转换成 HotTable 需要的 object[]
                const tableData = rows.map(row => {
                    let obj = {};
                    headers.forEach((header, i) => {
                        obj[header] = row[i] ?? null;
                    });
                    return obj;
                });

                // 转换 columnOptions
                const columnOptions = headers.map(h => ({
                    value: h,
                    label: h
                }));

                // ⭐更新 state
                setTableConfig(prev => ({
                    ...prev,
                    tableData,
                    columnOptions
                }));
            };

            reader.readAsArrayBuffer(file);
        };

        input.click();
    };

    // 更改表头名字
    const handleSetHeader = () => {
        const hotInstance = hotRef.current.hotInstance;
        const currentData = hotInstance.getData(); // 获取当前表格所有数据

        if (currentData.length > 0) {
            const newHeaders = currentData[0]; // 取第一行作为新标题
            const remainingData = currentData.slice(1); // 剩下的是数据部分

            // 更新状态或直接更新 Handsontable 设置
            hotInstance.updateSettings({
                colHeaders: newHeaders,
                data: remainingData
            });
            setTableConfig(prevState => ({...prevState, tableData: remainingData}));
            // 此时的“Key”：就是数字索引 0, 1, 2...
            setTableConfig(prevState => ({...prevState, columnOptions: newHeaders}));
        }
    };

    const handleVisualizeClick = () => {
        setUiState(prevState => ({...prevState, isCardVisible: false}));
        const hot = hotRef.current.hotInstance;
        // 从 Handsontable 实例获取最新的列头
        const headers = hot.getColHeader();
        // 获取每一列真正的数据字段名 (Key)
        // 还必须获取这个columns才能真正渲染
        const columnsSettings = hot.getSettings().columns;
        const options = headers.map((header, index) => {
            // 尝试获取该列对应的 data 属性（比如 "pred_ma_3"）
            // 如果没有定义 columns，通常就是 index
            const colKey = columnsSettings ? columnsSettings[index].data : index;

            return {
                label: header || `Column ${index + 1}`,
                value: colKey // 保持 key 的一致性
            };
        });

        setTableConfig(prevState => ({...prevState, columnOptions: options}));
        setUiState(prevState => ({...prevState, activeModal: 'visualization'}));
    };

    const handlePredictClick = () => {
        setPlotResult(prevState => ({...prevState, showChart: false}));
        handleClearYAxes();
        setUiState(prevState => ({...prevState, activeModal: 'statistical-prediction'}));

    };

    // async 是 Asynchronous（异步） 的缩写。它的核心作用是允许你在函数内部使用 await 关键字，
    // 从而用“写同步代码的方式”来处理异步操作
    const handlePredict = async () => {
        if (!uiState.isCardVisible) {
            setUiState(prevState => ({...prevState, activeModal: 'statistical-prediction'}));
        }

        // yAxes 存储的是被选中的列索引
        if (!chartConfig.yAxes || chartConfig.yAxes.length === 0) {
            message.warning("Please select one column for prediction");
            return;
        }
        if (chartConfig.yAxes.length > 1) {
            message.warning("Please select only one column for prediction");
            return;
        }

        // 使用 map 遍历每一行，提取对应的字段
        const rawData = tableConfig.tableData.map(row => {
            const val = row[chartConfig.yAxes];
            // 建议在这里进行数值转换，防止后续计算（如均值）出现字符串拼接错误
            return isNaN(parseFloat(val)) ? null : parseFloat(val);
        });

        // 转为浮点数，空值视为 0
        const numericData = rawData
            .map(val => Number(val) || 0)

        try {
            if (uiState.radioPredictOption === 1) {
                let output = movingAverage(numericData, params.k, params.n_predict);
                plotInputData("default_index", [chartConfig.yAxes], output);
                computeRMSE(numericData.slice(params.k), output.slice(params.k));
                computeMAD(numericData.slice(params.k), output.slice(params.k));
            }

            if (uiState.radioPredictOption !== 1) {
                function arrayToVector(arr) {
                    let v = new wasmInstance.Vector();
                    arr.forEach(x => v.push_back(x));
                    return v;
                }

                function vectorToArray(v) {
                    const arr = [];
                    const n = v.size();
                    for (let i = 0; i < n; i++) {
                        arr.push(v.get(i));
                    }
                    return arr;
                }

                let input_data = arrayToVector(numericData);
                if (uiState.radioPredictOption === 2) {
                    let raw_output = wasmInstance.singleSmooth(input_data, params.alpha);
                    let output = vectorToArray(raw_output);
                    // map 使用大括号时必须用 return
                    output = output.map((value) => value.toFixed(4));
                    // console.log(output);
                    plotInputData("default_index", [chartConfig.yAxes], output);
                    input_data.delete();
                    raw_output.delete();
                    // model.delete();
                    message.success("Single smoothing prediction finished");

                    computeRMSE(numericData.slice(1), output.slice(1));
                    computeMAD(numericData.slice(1), output.slice(1));
                    // 添加数据到表格里
                    if (uiState.checkAppendData === true) {
                        // Key 是给计算机看的（身份证），Label 是给用户看的（姓名）
                        const newColKey = `pred_1smooth_${params.alpha}`;
                        const columnName = tableConfig.columnOptions[chartConfig.yAxes].label;
                        const newColLabel = `1-smooth(${params.alpha})-forecast-${columnName}`;

                        appendColumn(newColKey, newColLabel, output);
                    }
                }
                if (uiState.radioPredictOption === 5) {
                    const feature_column_index = chartConfig.featureColumns;

                    const vector_X = [];
                    tableConfig.tableData.forEach(item => {
                        feature_column_index.forEach(key => {
                            // 空值视为0
                            vector_X.push(Number(item[key]) || 0);
                        });
                    });

                    let model = new wasmInstance.Regression(vector_X, input_data);
                    let weights = model.regression();
                    console.log('test');

                }
            }



            setUiState(prevState => ({...prevState, isCardVisible: true}));
        } catch (error) {
            message.error("Prediction failed.");
        }
    };

    /**
     * 辅助工具：统一处理数值转换
     */
    const parseValue = (val) => {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? val : parsed;
    };

    const plotInputData = (xIdx = "default_index", yIdxArray = [], predict_array = []) => {
        setPlotResult(prev => ({...prev, showChart: true}));
        const {tableData, columnOptions} = tableConfig;
        const isLineChart = uiState.radioChartOption === 1;
        const isHistChart = uiState.radioChartOption === 2;

        // 检查 X 轴列是否有值
        // row["default_index"] 会返回 undefined, 它不等于 null, 也不是空值
        const cleanData = tableData.filter(row => {
            const hasX = row[xIdx] !== null && row[xIdx] !== '';
            if (!isLineChart) return hasX; // 直方图只看X
            // 检查所有选中的 Y 轴列是否有值 (使用 every 确保全都有值，或用 some 只要有一个有值)
            let hasY = true;
            if (yIdxArray.length > 0)
                hasY = yIdxArray.some(yIdx => row[yIdx] !== null && row[yIdx] !== '');
            else
                hasY = yIdx => row[yIdx] !== null && row[yIdx] !== '';
            return hasX && hasY;
        });

        if (cleanData.length === 0) {
            return message.warning("Table is empty. Please enter or paste data first.");
        }

        // --- 构造数据 Traces ---
        let traces = [];
        // let xAxisTitle = "Time index";

        let xAxisTitle = xIdx === 'default_index' ? "Time index" : (columnOptions.find(opt => opt.value === xIdx)?.label || "Time index");
        // --- 相同的图片设置 ---
        // plotly 是静态渲染，若想让字体颜色跟随主题切换，非常麻烦，只能在明确主题时确定字体颜色
        const commonLayout = {
            // template: uiState.darkMode ? 'plotly_dark' : 'plotly', // 这个似乎没啥用
            autosize: true,
            height: 320,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: {t: 30, r: 30, b: 50, l: 60},
            font: {color: uiState.darkMode ? "#fff" : "#000"},
            xaxis: {
                title: {text: xAxisTitle},
                autorange: true,
                zeroline: false,
                showgrid: false,
                linecolor: uiState.darkMode ? "#fff" : "#69666a",
                linewidth: 2,
            },
            yaxis: {
                title: {text: isLineChart ? "Value" : "Frequency (Count)"},
                autorange: true,
                zeroline: false,
                linecolor: uiState.darkMode ? "#fff" : "#69666a",
                gridcolor: uiState.darkMode ? "#5a5858" : "#d4d4d5",
                linewidth: 2,
            }
        };

        if (isLineChart || predict_array?.length > 0) {
            // 预计算 X 轴数据，避免在 yIdxArray.map 内部重复循环
            const commonX = cleanData.map((row, index) =>
                xIdx === 'default_index' ? String(index + 1) : String(row[xIdx])
            );

            traces = yIdxArray.length > 0 ? yIdxArray.map(yIdx => ({
                    x: commonX,
                    y: cleanData.map(row => parseValue(row[yIdx])),
                    name: columnOptions[yIdx]?.label || yIdx,
                    type: 'scatter',
                    mode: chartConfig.isScatter && chartConfig.scatterYAxes?.includes(yIdx) ? 'markers' : 'lines+markers',
                })) :
                ({
                    x: commonX,
                    y: cleanData.map(row => parseValue(row[yIdxArray])),
                    name: columnOptions[yIdxArray]?.label || yIdxArray,
                    type: 'scatter',
                    mode: chartConfig.isScatter && chartConfig.scatterYAxes?.includes(yIdxArray) ? 'markers' : 'lines+markers',
                })

            // 处理预测数据
            // 处理 predict_array (假设它是一个数值数组)
            // 若 predict_array 没有在调用函数时赋值，则它是 undefined, if (predict_array) 或者调用lenght时 返回 false
            if (predict_array?.length > 0) {
                traces.push({
                    // x: commonX,
                    x: predict_array.map((_, i) => String(i + 1)),
                    y: predict_array.map(parseValue),
                    name: 'Forecast',
                    type: 'scatter',
                    mode: 'lines+markers',
                    line: {dash: 'dot', color: 'red'},
                    marker: {symbol: 'diamond'}
                });
            }
            if (isLineChart) {
                setPlotResult({
                    showChart: true,
                    data: traces,
                    xAxisName: xAxisTitle,
                    layout: commonLayout,
                });
            } else {
                setPlotResult({
                    showChart: true,
                    data: traces,
                    xAxisName: xAxisTitle,
                    layout: {
                        ...commonLayout,
                        yaxis: {
                            title: {text: isHistChart ? "Frequency (Count)" : "Value"},
                            autorange: true,
                            zeroline: false,
                            linecolor: uiState.darkMode ? "#fff" : "#69666a",
                            showgrid: false,
                            linewidth: 2,
                        }
                    }
                });
            }
        } else if (isHistChart) {
            // 直方图分支
            xAxisTitle = columnOptions.find(opt => opt.value === xIdx)?.label || "Value";
            traces = [{
                x: cleanData.map(row => parseValue(row[xIdx])),
                type: 'histogram',
                marker: {color: '#9cb1e1', line: {color: 'white', width: 1}}
            }];

            setPlotResult({
                showChart: true,
                data: traces,
                xAxisName: xAxisTitle,
                layout: {
                    ...commonLayout,
                    title: {text: "Data distribution"}
                } // 标题必须通过这个text来定义
            });
        }

        if (!uiState.isCardVisible) {
            message.success(`Successfully visualized ${cleanData.length} data points.`);
        }
    };


    return (
        // 1. 用 ConfigProvider 包裹整个应用或 Modal 所在区域
        <ConfigProvider
            theme={{
                // 2. 根据你的变量决定使用哪种算法
                algorithm: uiState.darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    // 试试这个紫色，或者换成你喜欢的任何颜色
                    colorPrimary: uiState.darkMode ? '#9e81d5' : '#311765',
                },
            }}
        >

            <Layout className={uiState.darkMode ? "dark" : "light"}>
                <Header className={`app-header ${uiState.darkMode ? "dark" : "light"}`}>
                    <div className="header-container">
                        {/* 左侧：Logo */}
                        <div className="header-left">
                            <div className="header-logo"
                                 style={{cursor: 'pointer'}}   // 鼠标悬停显示手型，提示可点击
                                 onClick={() => navigate("/")}   // 点击回到 Dashboard
                            >Dr Zhen Chen's Predictor
                            </div>
                        </div>

                        {/* --- 重点：重新找回的翻译插件容器 --- */}
                        <div className="header-center">
                            {/*<div id="google_translate_element"></div>*/}
                            <Translate/>
                        </div>
                        {/* ---------------------------------- */}

                        <div className="header-right">
                            <Space
                                // size="large"
                            >
                                <Menu theme={uiState.darkMode ? "dark" : "light"} mode="horizontal"
                                    // 使用路径作为 key，刷新页面也能正确高亮
                                      selectedKeys={[window.location.pathname]}
                                      onClick={({key}) => navigate(key)}
                                >
                                    <Menu.Item key="/">Home</Menu.Item>
                                    <Menu.Item key="/about">About</Menu.Item>
                                </Menu>

                                <Tooltip title="Switch Theme">
                                    <Button type="text" onClick={toggleTheme} className={"theme-button"}
                                            icon={uiState.darkMode ? <SunOutlined/> :
                                                <MoonOutlined/>}/>
                                </Tooltip>
                            </Space>
                        </div>
                    </div>
                </Header>

                {/*弹窗组件*/}
                <Modal
                    title="Select data for Visualization"
                    destroyOnHidden={true} //  每次打开都重新初始化内部组件
                    open={uiState.activeModal === 'visualization'}
                    onOk={() => {
                        plotInputData(chartConfig.xAxis, chartConfig.yAxes); // 确认时执行绘图逻辑
                        closeModal();
                    }}
                    onCancel={closeModal}
                >
                    <Radio.Group onChange={radioChartSelect} value={uiState.radioChartOption}>
                        <Space orientation="vertical">
                            <Radio value={1}>Line chart</Radio>
                            <Radio value={2}>Histogram chart</Radio>
                        </Space>
                    </Radio.Group>
                    <Divider/>

                    {(uiState.radioChartOption === 1) &&
                        <Form
                            layout="vertical"
                            wrapperCol={{span: 16}} // 24栅格制，8代表占据 1/3 的宽度
                            initialValues={chartConfig} // 初始化表单值
                            onValuesChange={(changedValues, allValues) => {
                                // 只要表单项发生变化，就会触发，allValues 就是最新的配置对象
                                setChartConfig(allValues);
                            }}
                        >

                            {/* Form.Item 的 name 字段自动对应 Select 的选取以及 initialValues={chartConfig}*/}
                            <Form.Item
                                label="Select X-Axis (Horizontal)"
                                name="xAxis"
                            >
                                <Select
                                    placeholder="Choose one column"
                                    options={[
                                        {label: 'Default (1, 2, 3...)', value: 'default_index'},
                                        ...tableConfig.columnOptions
                                    ]}
                                />
                            </Form.Item>

                            <Form.Item
                                label="Select Y-Axis (Verticals)"
                                name="yAxes"
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Choose one or more columns"
                                    options={tableConfig.columnOptions}
                                />
                            </Form.Item>

                            {/* 散点图开关：使用 valuePropName="checked" 确保布尔值正确同步 */}
                            {/*valuePropName 就像一个适配器。如果子组件不是用 value 来表示它的状态（比如 Checkbox, Switch 用 checked），
                            必须通过这个属性告诉 Form：“喂，别找 value 了，去它的 checked 属性里看！*/}
                            <Form.Item name="isScatter" valuePropName="checked">
                                <Checkbox>Scatter plot for some Y-Axis</Checkbox>
                            </Form.Item>

                            {/* 动态联动：只有勾选了 isScatter，才显示具体 Y 轴的选择框 */}
                            <Form.Item
                                // 结构是：
                                // Form.Item (逻辑层) -> Form.Item (实际显示的 UI 层)
                                // 为了不让逻辑层干扰 UI 布局，noStyle 是必须的
                                noStyle
                                // 只有当这两个字段中的任意一个发生变化时，才会触发该 Form.Item 内部代码的重新执行（渲染）
                                // 如果用户改了 X 轴，这里面就不会动，节省了计算资源
                                shouldUpdate={(prevValues, currentValues) =>
                                    prevValues.isScatter !== currentValues.isScatter || prevValues.yAxes !== currentValues.yAxes
                                }
                            >
                                {/* getFieldValue 函数从 form 提取所有记录的值*/}
                                {({ getFieldValue }) => {
                                    const isScatter = getFieldValue('isScatter');
                                    const selectedYAxes = getFieldValue('yAxes') || [];

                                    return isScatter ? (
                                        <Form.Item
                                            label="Specific Y-Axis for Scatter"
                                            name="scatterYAxes"
                                            // 过滤选项：只显示已经在上面 yAxes 里选中的列
                                            extra="Select which of the chosen Y-axes should be rendered as scatter points."
                                        >
                                            <Select
                                                mode="multiple"
                                                placeholder="Select scatter columns"
                                                options={tableConfig.columnOptions.filter(opt =>
                                                    selectedYAxes.includes(opt.value)
                                                )}
                                            />
                                        </Form.Item>
                                    ) : null;
                                }}
                            </Form.Item>
                        </Form>
                    }

                    {uiState.radioChartOption === 2 &&
                        <Form
                            layout="vertical"
                            wrapperCol={{span: 16}} // 24栅格制，8代表占据 1/3 的宽度
                            initialValues={chartConfig} // 初始化表单值
                            onValuesChange={(changedValues, allValues) => {
                                // 只要表单项发生变化，就会触发，allValues 就是最新的配置对象
                                setChartConfig(allValues);
                            }}
                        >

                            {/* Form.Item 的 name 字段自动对应 Select 的选取以及 initialValues={chartConfig}*/}
                            <Form.Item
                                label="Choose one Column"
                                name="xAxis"
                            >
                                <Select
                                    placeholder="Choose one column"
                                    options={tableConfig.columnOptions}
                                />
                            </Form.Item>
                        </Form>
                    }
                </Modal>

                <Modal
                    title="Prediction Settings"
                    open={uiState.activeModal === 'statistical-prediction'}
                    destroyOnHidden={true} //  每次打开都重新初始化内部组件
                    onOk={() => {
                        handlePredict(); // 确认时执行绘图逻辑
                        closeModal();
                    }}
                    onCancel={closeModal}
                >
                    <Form layout="horizontal">
                        <Form.Item label="Select data for prediction">
                            <Select
                                // mode="multiple"
                                options={tableConfig.columnOptions}
                                onChange={(val) => setChartConfig(prevState => ({
                                    ...prevState,
                                    yAxes: val
                                }))}
                            />
                        </Form.Item>
                    </Form>
                    <Radio.Group onChange={radioPredictionSelect} value={uiState.radioPredictOption}>
                        <Space orientation="vertical">
                            <Radio value={1}>Weighted Average</Radio>
                            <Radio value={2}>Single Exponential Smoothing</Radio>
                            <Radio value={3}>Double Exponential Smoothing (Holt method)</Radio>
                            <Radio value={4}>Triple Exponential Smoothing (Winters method)</Radio>
                            <Radio value={5}>Linear Regression</Radio>
                        </Space>
                    </Radio.Group>

                    {/*onValuesChange 是什么？*/}
                    {/* 这是 Form 组件的一个钩子函数（Callback）。每当用户在表单里输入一个字符、点击一个单选框或滑动进度条时，*/}
                    {/* 这个函数就会被触发*/}
                    <Form
                        // initialValues={params} // 关键：让表单显示你 state 里的 3 和 0.5
                        // onValuesChange={(changedValues, allValues) => {
                        //     if ('alpha' in changedValues) {
                        //         // ...prev: 使用展开运算符（Spread Operator）把旧的所有参数“解构”出来
                        //         // 用新收到的 alpha 值覆盖掉旧的值
                        //         setParams(prev => ({...prev, alpha: changedValues.alpha}));
                        //     }
                        // 自动匹配改变的键值对并更新到 state
                        onValuesChange={(changedValues) => {
                            setParams(prev => ({...prev, ...changedValues}));
                        }}
                    >
                        {/* 动态显示区域 */}
                        <div style={{marginTop: 16}}>
                            {uiState.radioPredictOption === 1 && (
                                // Form 组件中，label 和 name 扮演着完全不同的角色：
                                // label 是给用户看的（外观），而 name 是给代码看的（逻辑）
                                <Form.Item label={"k"} name={"k"} value={params.k}>
                                    {/* placeholder 这里设置淡色的占位值>*/}
                                    <InputNumber min={1} step={1} precision={0} placeholder={'3'}/>
                                </Form.Item>
                            )}

                            {uiState.radioPredictOption === 2 && (
                                <Form.Item label={'α'} // <InlineMath math="\alpha" />}
                                           name={"alpha"}
                                    // initialValue={0.5}
                                >
                                    {/*// placeholder="please input the value of α: "*/}
                                    {/* placeholder 这里设置淡色的占位值*/}
                                    <InputNumber min={0} max={1} step={0.1} placeholder={'0.2'}/>
                                </Form.Item>
                            )}

                            {uiState.radioPredictOption === 3 && (
                                // <>...</> 是 React Fragment，用来包多个组件（否则 JSX 会报错）
                                // flex 保证横排
                                // 这里的数字会被 react 自动转化为 px
                                <div style={{display: 'flex', gap: 30}}>
                                    <Form.Item label={'α'} name={"alpha"} style={{marginBottom: 0}}>
                                        <InputNumber min={0} max={1} step={0.1} placeholder={'0.2'}/>
                                    </Form.Item>
                                    <Form.Item label={'β'} name={"beta"} style={{marginBottom: 0}}>
                                        <InputNumber min={0} max={1} step={0.1} placeholder={'0.2'}/>
                                    </Form.Item>
                                </div>
                            )}

                            {uiState.radioPredictOption === 4 && (
                                // <>...</> 是 React Fragment，用来包多个组件（否则 JSX 会报错）
                                // flex 保证横排
                                // 这里的数字会被 react 自动转化为 px
                                <div style={{display: 'flex', gap: 30}}>
                                    <Form.Item label={'α'} name={"alpha"} style={{marginBottom: 0}}>
                                        <InputNumber min={0} max={1} step={0.1} placeholder={'0.2'}/>
                                    </Form.Item>
                                    <Form.Item label={'β'} name={"beta"} style={{marginBottom: 0}}>
                                        <InputNumber min={0} max={1} placeholder={0.2} step={0.1}/>
                                    </Form.Item>
                                    <Form.Item label={'γ'} name={"gamma"} style={{marginBottom: 0}}>
                                        <InputNumber min={0} max={1} placeholder={0.2} step={0.1}/>
                                    </Form.Item>
                                </div>
                            )}

                            {uiState.radioPredictOption === 5 && (
                                <Form.Item
                                    label="Select feature columns"
                                    name="featureColumns"
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder="Choose one or more columns"
                                        options={tableConfig.columnOptions}
                                        onChange={(val) => setChartConfig(prevState => ({
                                            ...prevState,
                                            featureColumns: val
                                        }))}
                                    />
                                </Form.Item>
                            )

                            }
                        </div>
                    </Form>

                    <Divider/>
                    <Form>
                        <Form.Item label={'The number of future periods to predict'} name={"n_predict"}>
                            <InputNumber min={1} step={1} placeholder={1}
                                         onChange={(val) => setParams(prevState => ({
                                             ...prevState,
                                             n_predict: val
                                         }))}/>
                        </Form.Item>
                    </Form>
                    <Divider/>
                    <div style={{marginTop: 16}}>
                        <Checkbox
                            // 这里只读取值，不修改值，否则循环渲染
                            checked={uiState.checkAppendData}

                            // 这里定义点击时才触发的动作
                            onChange={(e) => {
                                const isChecked = e.target.checked;
                                setUiState(prevState => ({
                                    ...prevState,
                                    checkAppendData: isChecked
                                }));
                            }}
                        >
                            Add prediction results to table as a new column
                        </Checkbox>
                    </div>
                </Modal>

                <Modal
                    title="Select a dataset"
                    destroyOnHidden={true} //  每次打开都重新初始化内部组件
                    open={uiState.activeModal === 'select-dataset'}
                    onOk={() => {
                        handleDatasetChange(tableConfig.selectDataset);
                        closeModal();
                    }}
                    onCancel={closeModal}
                >
                    <Form layout="horizontal">
                        <Form.Item label="Datasets: ">
                            <Select
                                // mode="multiple"
                                // placeholder="Choose a dataset"
                                options={datasetOptions}
                                // 这里满的value是数据集的名称，一个字符串
                                onChange={(value) => setTableConfig(prevState => ({
                                    ...prevState,
                                    selectDataset: value
                                }))}
                                defaultValue={tableConfig.selectDataset} // 初始显示
                            />
                        </Form.Item>
                    </Form>
                </Modal>

                {/* 2. 核心修复：Routes 应该放在这里，控制主体内容的切换 */}
                <Routes>
                    <Route path="/" element={
                        <Dashboard
                            ui={{uiState}}
                            table={{
                                hotRef,
                                tableConfig,
                                setTableConfig,
                                handleSetHeader,
                                resetData,
                            }}
                            actions={{
                                handleVisualizeClick,
                                handlePredictClick,
                                handlePredict,
                                handleDatasetChangeClick,
                                handleImportFileClick
                            }}
                            chart={{
                                plotResult,
                                params,
                                setParams,
                                metrics
                            }}
                        />
                    }/>
                    <Route path="/about" element={<AboutPage/>}/>
                    <Route path="*" element={
                        <Navigate to="/" replace/>}/> {/* 所有未匹配的都跳到 Dashboard */}
                </Routes>

                <Footer className="app-footer">An online forecaster ©Dr Zhen Chen 2026</Footer>
            </Layout>
        </ConfigProvider>);
}

export default App;