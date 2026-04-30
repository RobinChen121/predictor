import React from "react";
import {Layout, Row, Col, Card, Space, Button, Slider} from "antd"; // Divider
import {HotTable} from '@handsontable/react';
import Plot from "react-plotly.js";
import {ImportOutlined, BarChartOutlined} from "@ant-design/icons"; // PlayCircleOutlined
import Handsontable from "handsontable";

const {Content} = Layout;
const defaultItems = Handsontable.plugins.ContextMenu.DEFAULT_ITEMS;

// 传递 app.js 中的函数和变量
const Dashboard = ({
                       darkMode, table,
                       actions, chart
                   }) => {
    // 从 table 里取出所需的变量或函数
    const {
        hotRef,
        tableData,
        setTableData,
        columnOptions,
        handleSetHeader,
        resetData,
    } = table;
    const {
        handleVisualizeClick,
        handleExponentialSmoothClick,
        handleExponentialSmooth,
        handleDatasetChangeClick
    } = actions;
    const {
        plot_result,
        alpha,
        setAlpha,
        isCardVisible,
        RMSE,
        MAE
    } = chart;

    return (
        <Content className="app-content-fluid">
            {/* 主容器：三栏布局，因为有三个 col */}
            {/* 三个lg的总数应该是24*/}
            <Row gutter={[12, 24]} align="top">

                {/* 左侧栏：操作控制区 (合并原来的两个小 Card) */}
                <Col xs={24} lg={4}>
                    {/*内部使用 <Space orientation="vertical"> 将 Data Actions 卡片和 Analysis 卡片垂直堆叠*/}
                    {/* size 表示 里面 card 的间距 */}
                    <Space orientation="vertical" size={24} style={{width: '100%'}}>

                        {/* 原左侧：Data Actions */}
                        <Card title="Data Actions" className="side-card">
                            <p className={"notice-text"}>
                                You can paste your data directly into the right table or
                                input data from Excel.
                            </p>
                            <Space orientation="vertical" style={{width: '100%'}}>
                                <Button
                                    // type={"primary"}
                                    block
                                    // size="large"
                                    className="common-button"
                                    icon={<ImportOutlined/>}>
                                    Import from Excel
                                </Button>
                                {/*<Divider/>*/}
                                <Button
                                    type="primary"
                                    block
                                    // size="large"
                                    icon={<BarChartOutlined/>}
                                    onClick={handleVisualizeClick}
                                    className="common-button"
                                >Visualize Input</Button>
                            </Space>
                        </Card>

                        {/* 原右侧：Analysis (移动到这里，实现上下排列) */}
                        <Card title="Predictors" className="side-card">
                            <Space orientation="vertical" style={{width: '100%'}}>
                                <Button
                                    // type="primary"
                                    block
                                    // size="large"
                                    // icon={<PlayCircleOutlined/>}
                                    onClick={handleExponentialSmoothClick}
                                    className="common-button"
                                >
                                    Exponential Smoothing
                                </Button>
                            </Space>
                        </Card>

                    </Space>
                </Col>

                {/*中间栏*/}
                <Col xs={24} lg={16}>
                    {/*内部使用 <Space orientation="vertical"> 将 Data Actions 卡片和 Analysis 卡片垂直堆叠*/}
                    <Space orientation="vertical" size={0} style={{width: '100%'}}>
                        {/* 左侧表格部分 */}
                        <Card
                            // title="Data Editor (Excel Style)"
                            className="main-card"
                            style={{
                                flex: 1,
                                minWidth: 0
                            }} // 关键点：flex: 1 让它撑满，minWidth: 0 防止 Flex 溢出
                        >
                            <div className="excel-editor-container">
                                <HotTable
                                    ref={hotRef}
                                    data={tableData}
                                    // map 第一个参数为当前元素本身
                                    colHeaders={columnOptions.map(options => options.label)}
                                    afterChange={(changes) => {
                                        if (changes) {
                                            const updatedData = hotRef.current.hotInstance.getData();
                                            setTableData(updatedData);
                                        }
                                    }}
                                    rowHeaders={true}
                                    height="262px"
                                    width="100%"
                                    licenseKey="non-commercial-and-evaluation"
                                    selectionMode="multiple"
                                    dragToFill={true}
                                    copyPaste={true}
                                    stretchH={'last'}
                                    className="custom-handsontable"
                                    contextMenu={{
                                        items: {
                                            ...defaultItems.reduce((acc, key) => {
                                                acc[key] = {};
                                                return acc;
                                            }, {}),
                                            "---------": {},
                                            rename_header: {
                                                name: "Rename column head",
                                                hidden: function () {
                                                    const selected = this.getSelectedLast();
                                                    if (!selected) return true;
                                                    return selected[0] !== -1;
                                                },
                                                callback: function (key, selection) {
                                                    const col = selection[0].start.col;
                                                    const headers = this.getColHeader();
                                                    const newName = prompt("New column head", headers[col]);
                                                    if (newName) {
                                                        headers[col] = newName;
                                                        // 更新实例（即时生效）
                                                        this.updateSettings({colHeaders: headers});

                                                        // setColumnOptions(prevOptions => {
                                                        //     const newOptions = [...prevOptions];
                                                        //     // 找到对应的配置项并更新 label
                                                        //     if (newOptions[col]) {
                                                        //         newOptions[col] = { ...newOptions[col], label: newName };
                                                        //     }
                                                        //     return newOptions;
                                                        // });
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </Card>

                        {/* 下方：可视化结果 (只有在 plot_result 存在时显示) */}
                        {plot_result && (
                            <Card
                                // title="Visualization"
                                className="plot-card">
                                <div style={{display: 'flex', justifyContent: 'center'}}>
                                    <Plot
                                        data={plot_result.data}
                                        revision={Date.now()} // 关键：强制 Plotly 识别更新
                                        layout={{
                                            autosize: true,
                                            showlegend: true,
                                            height: 320, // 稍微调整高度以适应布局
                                            paper_bgcolor: 'transparent',
                                            plot_bgcolor: 'transparent',
                                            font: {color: darkMode ? "#fff" : "#000"},
                                            margin: {t: 30, r: 30, b: 50, l: 60},
                                            xaxis: {
                                                // 修正：增加 text 键，并提供后备默认值
                                                title: {
                                                    text: plot_result.xAxisName || "Time index"
                                                },
                                                showline: true,
                                                linecolor: darkMode ? "#fff" : "#69666a",
                                                linewidth: 2,
                                                autorange: true,
                                                zeroline: false,
                                            },
                                            yaxis: {
                                                title: {text: "Value"},
                                                showline: true,
                                                linecolor: darkMode ? "#fff" : "#69666a",
                                                linewidth: 2,
                                                autorange: true,
                                                zeroline: false,
                                            },
                                        }}
                                        useResizeHandler={true}
                                        style={{width: "100%", height: "100%"}}
                                    />
                                </div>
                            </Card>
                        )}
                    </Space>
                </Col>

                {/*右侧栏*/}
                <Col xs={24} lg={4}>
                    <Space orientation="vertical" size={24} style={{width: '100%'}}>
                        <Card className="side-card">
                            <Space orientation="vertical" style={{width: '100%'}}>

                                {/*<Divider/>*/}

                                <Button block onClick={handleDatasetChangeClick}
                                    // size={"large"}
                                        className="common-button"
                                >
                                    Select some dataset
                                </Button>

                                <Button block onClick={resetData}
                                    // size={"large"}
                                        className="common-button"
                                >
                                    Reset to default data
                                </Button>

                                <Button block onClick={handleSetHeader}
                                    // size={"large"}
                                        className="common-button"
                                >
                                    Set first row as headers
                                </Button>
                            </Space>
                        </Card>

                        {isCardVisible && (
                            <Card className="side-card parameter" title={"Parameters"}>
                                {/* 局部样式控制*/}
                                {/* 这是 <span> 最核心的用法。它本身没有任何默认样式（没有边距、没有加粗），它的存在就是为了让你能给某一段文字加上 CSS*/}
                                {/*flex: 1：让元素自动填满父容器中所有剩余的可用空间*/}
                                <div className = "parameter-slider">
                                    {/* 1. 标签部分 */}
                                    <span style={{
                                        fontWeight: "bold",
                                        // whiteSpace: "nowrap", // 防止 alpha 过长换行
                                        marginBottom: "0px"    // 微调：因为 Slider 的 marks 会撑开高度，这里手动微调对齐轴心
                                    }}>
                                    α: {alpha}
                                    </span>

                                    {/* 2. 滑动条容器 */}
                                    <div style={{flex: 1}}>
                                        <Slider
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            marks={{0: '0', 1: '1'}}
                                            onChange={(value) => setAlpha(value)}
                                            onChangeComplete={(value) => handleExponentialSmooth(value)}
                                            defaultValue={alpha}
                                            // 如果需要受控，取消下面这一行的注释
                                            // value={alpha}
                                            style={{
                                                margin: "0 0px", // 左右留白，防止滑块圆点超出容器
                                            }}
                                        />
                                    </div>
                                </div>
                            </Card>
                        )}

                        {isCardVisible && (
                            <Card className="side-card erros" title={"Forecasting errors"}>
                                {/* 局部样式控制*/}
                                {/* 这是 <span> 最核心的用法。它本身没有任何默认样式（没有边距、没有加粗），它的存在就是为了让你能给某一段文字加上 CSS*/}
                                <span style={{fontWeight: "bold"}}>RMSE:</span> {RMSE.toFixed(2)}
                                <br/>
                                <span style={{fontWeight: "bold"}}>MAE:</span> {MAE.toFixed(2)}
                            </Card>
                        )}
                    </Space>
                </Col>
            </Row>
        </Content>
    );
};

export default Dashboard;