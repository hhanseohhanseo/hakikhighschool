document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const classInput = document.getElementById('classInput');
    const numberInput = document.getElementById('numberInput');
    const errorMsg = document.getElementById('errorMsg');
    const dashboard = document.getElementById('dashboard');
    const weeklyTotalTitle = document.getElementById('weeklyTotalTitle');
    const dailyAverageTitle = document.getElementById('dailyAverageTitle');
    const comparisonText = document.getElementById('comparisonText');
    const goalProgress = document.getElementById('goalProgress');
    const goalText = document.getElementById('goalText');
    const goalHoursInput = document.getElementById('goalHours');
    const goalMinutesInput = document.getElementById('goalMinutes');
    const setGoalBtn = document.getElementById('setGoalBtn');
    const goalResultText = document.getElementById('goalResultText');
    
    let chartInstance = null;
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
                
                // 전체 데이터를 유지하고, 필요한 곳에서만 필터링합니다.
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
        renderDashboard(userData);
        dashboard.classList.remove('hidden');
    });

    function formatMinutes(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        if (hours === 0) return `${minutes}분`;
        return `${hours}시간 ${minutes}분`;
    }

    function renderDashboard(userData) {
        const realUsers = spreadsheetData.filter(row => {
            const rc = String(row[classKey]);
            const rn = String(row[numKey]);
            return row[classKey] !== undefined && row[numKey] !== undefined && 
                   rc !== '0' && rc !== '' && rn !== '0' && rn !== '' && 
                   rc.indexOf('평균') === -1;
        });
        
        const labels = dateColumns.map(col => {
            const match = col.match(/[0-9]+월\s*[0-9]+일/);
            if (match) return match[0];
            return col.substring(0, 5); 
        });
        
        const userUsage = dateColumns.map(col => Number(userData[col]) || 0);
        
        const avgUsage = dateColumns.map(col => {
            const sum = realUsers.reduce((acc, user) => acc + (Number(user[col]) || 0), 0);
            return realUsers.length > 0 ? sum / realUsers.length : 0;
        });

        // 스프레드시트의 수식 오류(예: 평균이 합계로 나오는 경우 등)를 방지하기 위해 
        // 앱 내에서 날짜 데이터들을 기반으로 직접 계산합니다.
        const totalUserUsage = userUsage.reduce((a, b) => a + b, 0);
        const userDailyAvg = dateColumns.length > 0 ? totalUserUsage / dateColumns.length : 0;

        const dateRangeEl = document.querySelector('.date-range');
        if (dateColumns.length > 0 && dateRangeEl) {
            const firstCol = dateColumns[0].match(/[0-9]+월\s*[0-9]+일/) || [dateColumns[0].substring(0,5)];
            const lastCol = dateColumns[dateColumns.length - 1].match(/[0-9]+월\s*[0-9]+일/) || [dateColumns[dateColumns.length - 1].substring(0,5)];
            dateRangeEl.textContent = `${firstCol[0]} ~ ${lastCol[0]}`;
        }
        const tabsEl = document.querySelector('.tabs');
        if (tabsEl) tabsEl.style.display = 'none'; // 단일 주간 데이터만 보여주므로 탭 숨김

        weeklyTotalTitle.textContent = formatMinutes(totalUserUsage);
        dailyAverageTitle.textContent = formatMinutes(userDailyAvg);

        // 사용 시간 균형: (내 하루 평균) vs (전체 하루 평균)
        const allUsersDailyAvgSum = realUsers.reduce((acc, user) => {
            const total = dateColumns.reduce((sum, col) => sum + (Number(user[col]) || 0), 0);
            const val = dateColumns.length > 0 ? total / dateColumns.length : 0;
            return acc + val;
        }, 0);
        const totalAllDailyAvg = allUsersDailyAvgSum / realUsers.length;
        const diff = userDailyAvg - totalAllDailyAvg;
        
        if (diff > 0) {
            comparisonText.textContent = `하루 평균, 전체 유저에 비해 ${formatMinutes(diff)} 많이 사용했습니다.`;
        } else if (diff < 0) {
            comparisonText.textContent = `하루 평균, 전체 유저에 비해 ${formatMinutes(Math.abs(diff))} 적게 사용했습니다.`;
        } else {
            comparisonText.textContent = `하루 평균 사용량이 전체 평균과 동일합니다.`;
        }

        // 나만의 목표 설정 및 비교
        function updateGoal() {
            const h = parseInt(goalHoursInput.value) || 0;
            const m = parseInt(goalMinutesInput.value) || 0;
            const targetMinutes = (h * 60) + m;
            
            if (targetMinutes === 0) {
                goalResultText.textContent = "목표 시간을 입력해 주세요.";
                goalProgress.style.width = '0%';
                return;
            }

            goalText.textContent = `나의 하루 목표: ${formatMinutes(targetMinutes)}`;
            
            // 지난주 기록(userDailyAvg)과 목표(targetMinutes) 비교
            const goalDiff = userDailyAvg - targetMinutes;
            
            if (goalDiff > 0) {
                goalResultText.innerHTML = `지난주 기록에 비해 하루 평균 <strong style="color: #ff3b30;">${formatMinutes(goalDiff)} 줄여야</strong> 새로운 목표를 달성할 수 있습니다!`;
                goalProgress.style.width = '100%';
                goalProgress.style.backgroundColor = '#ff3b30'; // 빨간색
            } else if (goalDiff < 0) {
                goalResultText.innerHTML = `지난주 기록 기준으로 하루 목표 시간보다 <strong style="color: #34c759;">${formatMinutes(Math.abs(goalDiff))} 여유</strong>가 있습니다. 이미 목표 달성에 가까운 상태입니다!`;
                const percent = Math.min((userDailyAvg / targetMinutes) * 100, 100);
                goalProgress.style.width = `${percent}%`;
                goalProgress.style.backgroundColor = '#34c759'; // 초록색
            } else {
                goalResultText.innerHTML = `지난주 하루 평균 사용시간이 새로운 목표와 완벽하게 같습니다. 잘 유지해 보세요!`;
                goalProgress.style.width = '100%';
                goalProgress.style.backgroundColor = '#34c759';
            }
        }

        setGoalBtn.onclick = updateGoal;
        updateGoal();

        renderChart(labels, userUsage, avgUsage);
    }

    function renderChart(labels, userData, avgData) {
        const ctx = document.getElementById('usageChart').getContext('2d');
        
        if (chartInstance) {
            chartInstance.destroy(); 
        }

        const avgAreaColor = 'rgba(200, 200, 200, 0.2)';

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: '전체 평균',
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
                        label: '하루 기기 사용 시간',
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
