import { useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useDailyRecords } from '../hooks/queries';
import { jsPDF } from 'jspdf';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import {
    CalendarDays, Download, TrendingUp, IndianRupee, Wallet,
    ChevronRight, ArrowLeft, Users, ListFilter
} from 'lucide-react';
import { maskPhoneNumber } from '../lib/privacy';

export function DailyRecords() {
    const { currentYear } = useAppStore();
    const { data, isLoading } = useDailyRecords(currentYear);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const {
        payments = [],
        devoteesMap = new Map(),
        totalDevotees = 0,
        globalPending = 0,
        startDate: festivalStartDate = null
    } = data || {};

    // Compute Daily Aggregates
    const dailyData = useMemo(() => {
        if (!festivalStartDate) return [];

        let start = parseISO(festivalStartDate);
        start.setHours(0, 0, 0, 0);

        // If there are payments before the festival start date, use the earliest payment date as the start date
        // to prevent negative "Day -29" outcomes.
        if (payments.length > 0) {
            const earliestPaymentTime = Math.min(...payments.map((p: any) => new Date(p.date || 0).getTime()));
            const earliestPayment = new Date(earliestPaymentTime);
            earliestPayment.setHours(0, 0, 0, 0);
            if (earliestPayment < start) {
                start = earliestPayment;
            }
        }

        const daysMap = new Map();

        // Group all payments by their formatted local date (assuming IST based on client/timestamp)
        payments.forEach(p => {
            const pDate = new Date(p.date || 0);
            const dateStr = format(pDate, 'yyyy-MM-dd');

            if (!daysMap.has(dateStr)) {
                daysMap.set(dateStr, {
                    date: pDate,
                    payments: []
                });
            }
            daysMap.get(dateStr).payments.push({
                ...p,
                name: devoteesMap.get(p.devotee_id)?.name || 'Unknown',
                phone: devoteesMap.get(p.devotee_id)?.phone || '',
                receiptNo: devoteesMap.get(p.devotee_id)?.receipt_no || '-'
            });
        });

        // Convert Map to array and calculate Day Number based on difference from startDate
        const days = Array.from(daysMap.values()).map(dayInfo => {
            const dayPayments = dayInfo.payments;

            // Calculate Day Number: (actual_date - start_date) in days + 1
            // We use UTC hours resetting to ensure exact integer days differ.
            const startCopy = new Date(start.getTime());
            startCopy.setHours(0, 0, 0, 0);
            const currentCopy = new Date(dayInfo.date.getTime());
            currentCopy.setHours(0, 0, 0, 0);

            const diffTime = currentCopy.getTime() - startCopy.getTime();
            const dayDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const dayNumber = dayDiff + 1;

            const dayCash = dayPayments.filter((p: any) => p.mode === 'Cash').reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            const dayUPI = dayPayments.filter((p: any) => p.mode === 'UPI').reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            const dayTotal = dayCash + dayUPI;

            return {
                dayNumber,
                date: dayInfo.date,
                entries: dayPayments.length,
                cash: dayCash,
                upi: dayUPI,
                total: dayTotal,
                payments: dayPayments
            };
        });

        // Sort by actual date ascending
        days.sort((a, b) => a.date.getTime() - b.date.getTime());

        return days;
    }, [payments, festivalStartDate, devoteesMap]);

    const totalCollected = dailyData.reduce((sum, d) => sum + d.total, 0);
    const totalCash = dailyData.reduce((sum, d) => sum + d.cash, 0);
    const totalUPI = dailyData.reduce((sum, d) => sum + d.upi, 0);

    const daysWithCollection = dailyData.filter(d => d.total > 0);
    const highestDay = daysWithCollection.length > 0
        ? daysWithCollection.reduce((max, d) => d.total > max.total ? d : max, daysWithCollection[0])
        : null;



    const maxChartVal = highestDay ? Math.max(highestDay.total, 1000) : 1000;

    const exportPDF = () => {
        const pdf = new jsPDF('p', 'pt', 'a4');
        pdf.setFont('helvetica');

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SVSVBB Committee', 40, 40);

        pdf.setFontSize(12);
        pdf.text(`Daily Chanda Collection Records (${currentYear})`, 40, 60);

        let y = 90;

        // Header
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Day', 40, y);
        pdf.text('Date', 80, y);
        pdf.text('Entries', 180, y);
        pdf.text('Cash', 240, y);
        pdf.text('UPI', 320, y);
        pdf.text('Total', 400, y);

        y += 10;
        pdf.setLineWidth(0.5);
        pdf.line(40, y, 500, y);
        y += 15;

        pdf.setFont('helvetica', 'normal');
        dailyData.forEach((d: any) => {
            pdf.text(d.dayNumber.toString(), 40, y);
            pdf.text(format(d.date, 'dd-MM-yyyy'), 80, y);
            pdf.text(d.entries.toString(), 180, y);
            pdf.text(`Rs ${d.cash}`, 240, y);
            pdf.text(`Rs ${d.upi}`, 320, y);
            pdf.text(`Rs ${d.total}`, 400, y);
            y += 15;

            if (y > 780) {
                pdf.addPage();
                y = 40;
            }
        });

        y += 10;
        pdf.setLineWidth(1);
        pdf.line(40, y, 500, y);
        y += 15;

        pdf.setFont('helvetica', 'bold');
        pdf.text('OVERALL TOTALS', 40, y);
        y += 15;
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Total Cash: Rs ${totalCash.toLocaleString()}`, 40, y);
        pdf.text(`Total UPI: Rs ${totalUPI.toLocaleString()}`, 200, y);
        pdf.text(`Grand Total: Rs ${totalCollected.toLocaleString()}`, 360, y);

        pdf.save(`Daily_Collection_Records_${currentYear}.pdf`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!festivalStartDate) {
        return (
            <div className="p-8 text-center text-gray-500 bg-white rounded-2xl shadow-sm">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Start Date Missing</h2>
                <p>Please configure the Festival Start Date in Settings to generate the schedule.</p>
            </div>
        );
    }

    if (selectedDay !== null) {
        const dayRecord = dailyData.find(d => d.dayNumber === selectedDay);
        if (!dayRecord) return null;

        return (
            <div className="space-y-4">
                <button
                    onClick={() => setSelectedDay(null)}
                    className="flex items-center gap-2 text-primary hover:text-orange-700 font-bold bg-white px-4 py-2 rounded-xl shadow-sm w-fit"
                >
                    <ArrowLeft size={18} /> Back to Daily Summary
                </button>

                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
                                Day {dayRecord.dayNumber} Collection
                            </h2>
                            <p className="text-gray-500 font-medium">Date: {format(dayRecord.date, 'dd MMM yyyy')}</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Cash</p>
                                <p className="font-black text-emerald-800">₹{dayRecord.cash.toLocaleString()}</p>
                            </div>
                            <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-0.5">UPI</p>
                                <p className="font-black text-indigo-800">₹{dayRecord.upi.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-600 font-bold">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Receipt No</th>
                                    <th className="px-4 py-3">Devotee Name</th>
                                    <th className="px-4 py-3">Phone</th>
                                    <th className="px-4 py-3 text-right">Payment</th>
                                    <th className="px-4 py-3 text-center">Mode</th>
                                    <th className="px-4 py-3 rounded-tr-lg">Collected By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {dayRecord.payments.map((p: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3 font-mono text-xs">{p.receiptNo}</td>
                                        <td className="px-4 py-3 font-bold text-gray-900">{p.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{maskPhoneNumber(p.phone)}</td>
                                        <td className="px-4 py-3 font-black text-right text-gray-900">₹{p.amount?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.mode === 'UPI' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                                                }`}>
                                                {p.mode}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600">{p.volunteer_name || 'Admin'}</td>
                                    </tr>
                                ))}
                                {dayRecord.payments.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-gray-400 font-medium">No collections recorded on this day.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        <CalendarDays className="text-primary" /> Daily Records
                    </h1>
                    <p className="text-gray-500 mt-1">Unlimited Chanda Collection Dashboard</p>
                </div>
                <button
                    onClick={exportPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl shadow-sm hover:bg-black font-bold text-sm transition-all hover:scale-105 active:scale-95"
                >
                    <Download size={16} /> Export PDF
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
                    <div className="flex gap-2 items-center text-emerald-600 mb-2">
                        <IndianRupee size={18} />
                        <span className="text-xs font-black uppercase tracking-wider">Total Collection</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 tracking-tight">₹{totalCollected.toLocaleString()}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex gap-2 items-center text-rose-500 mb-2">
                        <Wallet size={18} />
                        <span className="text-xs font-black uppercase tracking-wider">Total Pending</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 tracking-tight">₹{globalPending.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">Remaining/Unpaid overall</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex gap-2 items-center text-blue-500 mb-2">
                        <Users size={18} />
                        <span className="text-xs font-black uppercase tracking-wider">Total Devotees</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 tracking-tight">{totalDevotees}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden">
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Collection Trend</h2>
                <div className="flex items-end gap-1 sm:gap-2 h-40 overflow-x-auto pb-2 scrollbar-none w-full">
                    {dailyData.map((d: any) => {
                        const height = d.total === 0 ? 0 : Math.max(((d.total / maxChartVal) * 100), 5); // 5% min height if > 0
                        const isHighest = highestDay?.dayNumber === d.dayNumber;

                        return (
                            <div
                                key={d.dayNumber}
                                className="flex-1 flex flex-col justify-end min-w-[12px] group relative items-center"
                            >
                                <div className={`w-full max-w-[20px] rounded-t-sm transition-all duration-300 ${isHighest ? 'bg-orange-500 group-hover:bg-orange-600' : 'bg-orange-200 group-hover:bg-orange-300'
                                    }`}
                                    style={{ height: `${height}%` }}
                                />

                                {/* Tooltip */}
                                <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                                    Day {d.dayNumber}: ₹{d.total.toLocaleString()}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-xs font-bold text-gray-400 px-1">
                    {dailyData.length > 0 && (
                        <>
                            <span>Day {dailyData[0].dayNumber}</span>
                            <span>Day {dailyData[dailyData.length - 1].dayNumber}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <ListFilter size={18} className="text-gray-400" /> Day-by-Day View
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-bold text-gray-600">Day</th>
                                <th className="px-6 py-4 font-bold text-gray-600">Date</th>
                                <th className="px-6 py-4 font-bold text-gray-600 text-center">Entries</th>
                                <th className="px-6 py-4 font-bold text-gray-600 text-right">Cash</th>
                                <th className="px-6 py-4 font-bold text-gray-600 text-right">UPI</th>
                                <th className="px-6 py-4 font-bold text-gray-900 text-right text-base">Total</th>
                                <th className="px-6 py-4 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {dailyData.map((d: any) => (
                                <tr
                                    key={d.dayNumber}
                                    className={`hover:bg-orange-50/30 transition-colors group cursor-pointer ${highestDay?.dayNumber === d.dayNumber ? 'bg-orange-50/20' : 'bg-white'
                                        }`}
                                    onClick={() => setSelectedDay(d.dayNumber)}
                                >
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded text-xs">
                                            Day {d.dayNumber}
                                        </span>
                                        {highestDay?.dayNumber === d.dayNumber && (
                                            <span className="ml-2 text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full uppercase tracking-widest hidden sm:inline-block">Highest</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-600">
                                        {format(d.date, 'dd-MM-yyyy')}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-blue-50 text-blue-700 font-black text-xs px-2 py-1 rounded-full">{d.entries}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                        ₹{d.cash.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">
                                        ₹{d.upi.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-gray-900 text-base">
                                        ₹{d.total.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button className="text-gray-400 group-hover:text-primary transition-colors p-1 bg-gray-50 group-hover:bg-orange-100 rounded-lg">
                                            <ChevronRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
