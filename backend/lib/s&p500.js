import axios from "axios";

const SNP_API_URL = "https://cdn.statically.io/gh/datasets/s-and-p-500-companies@main/data/constituents.csv";

const SEC_COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";

const REQUEST_TIMEOUT_MS = 30000;

// Keep SEC requests reasonably limited.
const SEC_CONCURRENCY = 5;

const SEC_HEADERS = {
    "User-Agent": "Open Map API noreply@getopenmap.com",
    "Accept-Encoding": "gzip, deflate",
};


/**
 * Returns S&P 500 companies with their latest reported
 * stockholders' equity from SEC EDGAR.
 */
export async function getSNP500Companies(client = axios) {
    try {
        const response = await client.get(SNP_API_URL, {
            timeout: REQUEST_TIMEOUT_MS,
        });

        if (response.status !== 200) {
            throw new Error(
                `Request to ${SNP_API_URL} returned HTTP ${response.status}`
            );
        }

        const companies = parseCSV(response.data);

        const enrichedCompanies = await mapWithConcurrency(
            companies,
            SEC_CONCURRENCY,
            async (company) => {
                const cik = company.CIK ?? null;

                const netWorth = await getNetWorth(client, cik);

                return {
                    ...company,
                    NetWorth: netWorth,
                };
            }
        );

        return enrichedCompanies;
    } catch (error) {
        console.error(
            `Error fetching S&P 500 companies: ${error.message}`
        );

        return [];
    }
}


/**
 * Returns the latest reported stockholders' equity for a company
 * from the SEC EDGAR Company Facts API.
 */
async function getNetWorth(client, cik) {
    if (!cik) {
        return null;
    }

    try {
        // SEC CIKs must be zero-padded to 10 digits.
        const paddedCIK = String(cik)
            .replace(/\D/g, "")
            .padStart(10, "0");

        if (paddedCIK.length !== 10) {
            console.warn(`Invalid CIK: ${cik}`);
            return null;
        }

        const url = `${SEC_COMPANY_FACTS_URL}/CIK${paddedCIK}.json`;

        const response = await client.get(url, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: SEC_HEADERS,
        });

        if (response.status !== 200) {
            throw new Error(
                `Request to ${url} returned HTTP ${response.status}`
            );
        }

        const facts = response.data?.facts?.["us-gaap"];

        if (!facts) {
            console.warn(`No US-GAAP facts found for CIK ${cik}`);
            return null;
        }

        /*
         * Companies can report equity using different XBRL concepts.
         * Try the common concepts in preferred order.
         */
        const equityData =
            facts.StockholdersEquity?.units?.USD ??
            facts.StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest
                ?.units?.USD ??
            facts.PartnersCapital?.units?.USD ??
            null;

        if (!Array.isArray(equityData) || equityData.length === 0) {
            console.warn(`No equity data found for CIK ${cik}`);
            return null;
        }

        /*
         * SEC data can contain duplicate facts from multiple filings.
         *
         * Prefer facts that:
         * - have a numeric value
         * - have an end date
         * - come from standard SEC periodic reports
         */
        const validEntries = equityData.filter((entry) => {
            return (
                typeof entry.val === "number" &&
                entry.end &&
                ["10-K", "10-Q", "20-F", "40-F"].includes(entry.form)
            );
        });

        if (validEntries.length === 0) {
            return null;
        }

        /*
         * Sort primarily by reporting-period end date.
         *
         * If multiple filings contain the same period, prefer the
         * most recently filed version.
         */
        validEntries.sort((a, b) => {
            const endDifference =
                new Date(b.end).getTime() -
                new Date(a.end).getTime();

            if (endDifference !== 0) {
                return endDifference;
            }

            return (
                new Date(b.filed ?? 0).getTime() -
                new Date(a.filed ?? 0).getTime()
            );
        });

        return validEntries[0].val;
    } catch (error) {
        console.error(
            `Error fetching net worth for CIK ${cik}: ${error.message}`
        );

        return null;
    }
}


/**
 * Runs async operations with limited concurrency.
 *
 * This prevents sending hundreds of SEC requests simultaneously.
 */
async function mapWithConcurrency(items, concurrency, callback) {
    const results = new Array(items.length);

    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index = nextIndex++;

            if (index >= items.length) {
                return;
            }

            results[index] = await callback(items[index], index);
        }
    }

    const workerCount = Math.min(
        concurrency,
        items.length
    );

    await Promise.all(
        Array.from(
            { length: workerCount },
            () => worker()
        )
    );

    return results;
}


/**
 * Parses CSV data while supporting:
 *
 * - quoted values
 * - commas inside quoted values
 * - escaped double quotes
 * - CRLF/LF line endings
 */
function parseCSV(text) {
    if (!text) {
        return [];
    }

    const rows = [];

    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote: ""
                field += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }

            continue;
        }

        if (char === "," && !inQuotes) {
            row.push(field.trim());
            field = "";
            continue;
        }

        if (
            (char === "\n" || char === "\r") &&
            !inQuotes
        ) {
            // Handle CRLF as a single newline.
            if (char === "\r" && nextChar === "\n") {
                i++;
            }

            row.push(field.trim());

            if (
                row.some((value) => value.length > 0)
            ) {
                rows.push(row);
            }

            row = [];
            field = "";
            continue;
        }

        field += char;
    }

    // Handle final row if the file doesn't end in a newline.
    if (field.length > 0 || row.length > 0) {
        row.push(field.trim());

        if (row.some((value) => value.length > 0)) {
            rows.push(row);
        }
    }

    if (rows.length === 0) {
        return [];
    }

    // Remove UTF-8 BOM if present.
    const headers = rows[0].map((header, index) => {
        const cleaned = header.trim();

        if (index === 0) {
            return cleaned.replace(/^\uFEFF/, "");
        }

        return cleaned;
    });

    return rows.slice(1).map((values) => {
        const company = {};

        headers.forEach((header, index) => {
            const value = values[index]?.trim();

            company[header] =
                value && value.length > 0
                    ? value
                    : null;
        });

        return company;
    });
}