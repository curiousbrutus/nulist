'use client';

import { useState } from 'react';

export default function ImportPage() {
    const [data, setData] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleImport = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data })
            });
            const json = await res.json();
            setResult(json);
        } catch (err: any) {
            setResult({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Excel/Worklist Import</h1>
            <p className="mb-4 text-gray-600">
                Paste your Excel data here (SIRA, DATE, LOCATION, DESCRIPTION, PRIMARY, SECONDARY, DUE DATE, NOTES, etc).
                Ensure it is tab-separated (standard copy-paste from Excel).
            </p>

            <textarea
                className="w-full h-64 p-4 border rounded font-mono text-sm"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="Paste Excel data here..."
            />

            <div className="mt-4 flex gap-4">
                <button
                    onClick={handleImport}
                    disabled={loading || !data}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Importing...' : 'Start Import'}
                </button>
            </div>

            {result && (
                <div className={`mt-6 p-4 rounded ${result.error || result.errors?.length ? 'bg-red-50' : 'bg-green-50'}`}>
                    <h3 className="font-bold mb-2">Result:</h3>
                    {result.error && <div className="text-red-600">{result.error}</div>}
                    {result.created_tasks !== undefined && (
                        <div className="text-green-700">
                            Successfully created {result.created_tasks} tasks.
                        </div>
                    )}
                    {result.errors && result.errors.length > 0 && (
                        <div className="mt-2">
                            <h4 className="font-semibold text-red-800">Errors rows:</h4>
                            <ul className="list-disc pl-5 text-red-700 text-sm">
                                {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
