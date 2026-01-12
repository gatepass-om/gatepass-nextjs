
'use server';
/**
 * @fileOverview A Genkit flow for fetching worker data from a mock service.
 * In a real-world scenario, this would connect to an external HR or employee database.
 *
 * - fetchWorkerData - A function that simulates fetching worker details.
 * - FetchWorkerDataInput - The input type for the function.
 * - FetchWorkerDataOutput - The output type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Certificate } from '@/lib/types';
import mockWorkerDatabase from '@/lib/worker-database.json';


const FetchWorkerDataInputSchema = z.object({
  workerId: z.string().describe('The unique ID of the worker to fetch.'),
  operatorId: z.string().optional().describe('If provided, only workers belonging to this operator are returned.'),
});
export type FetchWorkerDataInput = z.infer<typeof FetchWorkerDataInputSchema>;

const CertificateSchema = z.object({
    name: z.string(),
    expiryDate: z.string().optional(),
});

const FetchWorkerDataOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  company: z.string(),
  age: z.number(),
  nationality: z.string(),
  jobTitle: z.string(),
  idNumber: z.string(),
  certificates: z.array(CertificateSchema),
}).nullable();
export type FetchWorkerDataOutput = z.infer<typeof FetchWorkerDataOutputSchema>;


/**
 * Exported function to be called from the application server-side code.
 * It wraps the Genkit flow.
 */
export async function fetchWorkerData(input: FetchWorkerDataInput): Promise<FetchWorkerDataOutput> {
  return fetchWorkerDataFlow(input);
}

/**
 * The main Genkit flow for fetching worker data.
 */
const fetchWorkerDataFlow = ai.defineFlow(
  {
    name: 'fetchWorkerDataFlow',
    inputSchema: FetchWorkerDataInputSchema,
    outputSchema: FetchWorkerDataOutputSchema,
  },
  async ({ workerId, operatorId }) => {
    console.log(`[Flow] Fetching data for worker ID: ${workerId}`);
    
    // Simulate a network delay
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));
    
    // Find worker in the imported JSON database
    let worker = mockWorkerDatabase.workers.find(w => w.id.toUpperCase() === workerId.toUpperCase());

    // If operatorId is provided, ensure the found worker belongs to that operator
    if (worker && operatorId) {
        // This is a mock: In a real system you'd query where companyId matches operatorId
        // Here we'll simulate by checking company name.
        const operatorCompanies = ["PDO", "OQ", "OXY"]; // Example operator company names
        if (!operatorCompanies.includes(worker.company)) {
            console.log(`[Flow] Worker ${workerId} found, but does not belong to operator ${operatorId}.`);
            worker = undefined; // Unset the worker if they don't belong to the operator
        }
    }


    if (worker) {
        console.log(`[Flow] Found worker: ${worker.name}`);
        return worker as NonNullable<FetchWorkerDataOutput>;
    } else {
        console.log(`[Flow] Worker ID ${workerId} not found.`);
        return null;
    }
  }
);
