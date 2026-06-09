document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const classInput = document.getElementById('classInput');
    const numberInput = document.getElementById('numberInput');
    const errorMsg = document.getElementById('errorMsg');
    const dashboard = document.getElementById('dashboard');
    const weeklyTotalTitle = document.getElementById('weeklyTotalTitle');
    const dailyAverageTitle = document.getElementById('dailyAverageTitle');
    const comparisonOverallText = document.getElementById('comparisonOverallText');
    const comparisonClassText = document.getElementById('comparisonClassText');
    
    let chartInstanceOverall = null;
    let chartInstanceClass = null;
    let spreadsheetData = [];
    let dateColumns = [];
    let classKey = '반';
    let numKey = '번호';

    const API_URL = 'https://script.google.com/macros/s/AKfycbyHbciN_H5ZxRMZQrzh_wx43JexxLUXaxC5hxU4lIU2YKPzCRrllXtOprITRhzCBrJscg/exec';

    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const keys = Object.keys(data[0]);
                classKey = keys.find(k => k.includes('반')) || '반';
                numKey = keys.find(k => k.includes('번호')) || '번호';
                
                spreadsheetData = data;
                
                dateColumns = keys.filter(k => k.includes('GMT') || k.includes('202') || k.match(/^[0-9]+월/));
                if (dateColumns.length === 0) {
                   dateColumns = keys.slice(2, 9); 
                }
            }
            console.log("데이터 로드 완료:", spreadsheetData);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            errorMsg.textContent = '데이터를 불러오는데 실패했습니다.';
        });

    searchBtn.addEventListener('click', () => {
        const classVal = classInput.value.trim();
        const numVal = numberInput.value.trim();
        
        if (!classVal || !numVal) {
            errorMsg.textContent = '반과 번호를 모두 입력해주세요.';
            return;
        }

        const parsedClass = parseInt(classVal, 10);
        const parsedNum = parseInt(numVal, 10);

        const userData = spreadsheetData.find(row => {
            if (row[classKey] === undefined || row[numKey] === undefined) return false;
            const rowClass = parseInt(String(row[classKey]).replace(/[^0-9]/g, ''), 10);
            const rowNum = parseInt(String(row[numKey]).replace(/[^0-9]/g, ''), 10);
            return rowClass === parsedClass && rowNum === parsedNum;
        });

        if (!userData) {
            errorMsg.textContent = '해당 반, 번호의 데이터를 찾을 수 없습니다.';
            dashboard.classList.add('hidden');
            return;
        }

        errorMsg.textContent = '';
        renderDashboard(userData, parsedClass);
        dashboard.classList.remove('hidden');
    });

    function formatMinutes(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        if (hours === 0) return `${minutes}분`;
        return `${hours}시간 ${minutes}분`;
    }

    function renderDashboard(userData, userClassNum) {
        const realUsers = spreadsheetData.filter(row => {
            const rc = String(row[classKey]);
            const rn = String(row[numKey]);
            return row[classKey] !== undefined && row[numKey] !== undefined && 
                   rc !== '0' && rc !== '' && rn !== '0' && rn !== '' && 
                   rc.indexOf('평균') === -1;
        });
        
        // 반 학생들만 필터링
        const classUsers = realUsers.filter(row => {
            const rc = parseInt(String(row[classKey]).replace(/[^0-9]/g, ''), 10);
            return rc === userClassNum;
        });

        const labels = dateColumns.map(col => {
            const match = col.match(/[0-9]+월\s*[0-9]+일/);
            if (match) return match[0];
            return col.substring(0, 5); 
        });
        
        const userUsage = dateColumns.map(col => Number(userData[col]) || 0);
        
        // 전체 평균 계산
        const overallAvgUsage = dateColumns.map(col => {
            const sum = realUsers.reduce((acc, user) => acc + (Number(user[col]) || 0), 0);
            return realUsers.length > 0 ? sum / realUsers.length : 0;
        });

        // 반 평균 계산
        const classAvgUsage = dateColumns.map(col => {
            const sum = classUsers.reduce((acc, user) => acc + (Number(user[col]) || 0), 0);
            return classUsers.length > 0 ? sum / classUsers.length : 0;
        });

        const totalUserUsage = userUsage.reduce((a, b) => a + b, 0);
        const userDailyAvg = dateColumns.length > 0 ? totalUserUsage / dateColumns.length : 0;

        const dateRangeEl = document.querySelector('.date-range');
        if (dateColumns.length > 0 && dateRangeEl) {
            const firstCol = dateColumns[0].match(/[0-9]+월\s*[0-9]+일/) || [dateColumns[0].substring(0,5)];
            const lastCol = dateColumns[dateColumns.length - 1].match(/[0-9]+월\s*[0-9]+일/) || [dateColumns[dateColumns.length - 1].substring(0,5)];
            dateRangeEl.textContent = `${firstCol[0]} ~ ${lastCol[0]}`;
        }
        const tabsEl = document.querySelector('.tabs');
        if (tabsEl) tabsEl.style.display = 'none';

        weeklyTotalTitle.textContent = formatMinutes(totalUserUsage);
        dailyAverageTitle.textContent = formatMinutes(userDailyAvg);

        // 1. 전체 평균 비교
        const allUsersDailyAvgSum = realUsers.reduce((acc, user) => {
            const total = dateColumns.reduce((sum, col) => sum + (Number(user[col]) || 0), 0);
            const val = dateColumns.length > 0 ? total / dateColumns.length : 0;
            return acc + val;
        }, 0);
        const totalAllDailyAvg = realUsers.length > 0 ? allUsersDailyAvgSum / realUsers.length : 0;
        const diffOverall = userDailyAvg - totalAllDailyAvg;
        
        if (diffOverall > 0) {
            comparisonOverallText.innerHTML = `● 전체 유저 하루 평균에 비해 <strong>${formatMinutes(diffOverall)} 많이</strong> 사용했습니다.`;
        } else if (diffOverall < 0) {
            comparisonOverallText.innerHTML = `● 전체 유저 하루 평균에 비해 <strong>${formatMinutes(Math.abs(diffOverall))} 적게</strong> 사용했습니다.`;
        } else {
            comparisonOverallText.innerHTML = `● 전체 유저 하루 평균 사용량과 동일합니다.`;
        }

        // 2. 반 평균 비교
        const classUsersDailyAvgSum = classUsers.reduce((acc, user) => {
            const total = dateColumns.reduce((sum, col) => sum + (Number(user[col]) || 0), 0);
            const val = dateColumns.length > 0 ? total / dateColumns.length : 0;
            return acc + val;
        }, 0);
        const totalClassDailyAvg = classUsers.length > 0 ? classUsersDailyAvgSum / classUsers.length : 0;
        const diffClass = userDailyAvg - totalClassDailyAvg;

        if (diffClass > 0) {
            comparisonClassText.innerHTML = `● ${userClassNum}반 하루 평균에 비해 <strong>${formatMinutes(diffClass)} 많이</strong> 사용했습니다.`;
        } else if (diffClass < 0) {
            comparisonClassText.innerHTML = `● ${userClassNum}반 하루 평균에 비해 <strong>${formatMinutes(Math.abs(diffClass))} 적게</strong> 사용했습니다.`;
        } else {
            comparisonClassText.innerHTML = `● ${userClassNum}반 하루 평균 사용량과 동일합니다.`;
        }

        // 차트 렌더링 (전체 평균, 반 평균)
        chartInstanceOverall = renderChart('usageChartOverall', chartInstanceOverall, labels, userUsage, overallAvgUsage, '전체 평균');
        chartInstanceClass = renderChart('usageChartClass', chartInstanceClass, labels, userUsage, classAvgUsage, '반 평균');
    }

    function renderChart(canvasId, chartInstance, labels, userData, avgData, avgLabel) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if (chartInstance) {
            chartInstance.destroy(); 
        }

        const avgAreaColor = 'rgba(200, 200, 200, 0.2)';

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: avgLabel,
                        data: avgData,
                        borderColor: '#cccccc',
                        backgroundColor: avgAreaColor,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: true,
                        pointRadius: 0,
                        tension: 0.4
                    },
                    {
                        type: 'bar',
                        label: '나의 사용 시간',
                        data: userData,
                        backgroundColor: function(context) {
                            const value = context.dataset.data[context.dataIndex];
                            return value < 200 ? '#34c759' : '#ff9500'; 
                        },
                        borderRadius: {
                            topLeft: 6,
                            topRight: 6,
                            bottomLeft: 0,
                            bottomRight: 0
                        },
                        barThickness: 16
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f2f2f7',
                            drawBorder: false
                        },
                        ticks: {
                            callback: function(value) {
                                return (value / 60) + '시간';
                            },
                            stepSize: 240, 
                            color: '#8e8e93',
                            font: { size: 12 }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8e8e93',
                            font: { size: 13 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false 
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                return formatMinutes(val); 
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                }
            }
        });
    }
});
