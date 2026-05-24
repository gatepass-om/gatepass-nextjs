import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{
    product_id: string;
  }>;
};

export async function POST(_req: Request, { params }: RouteContext) {
  const { product_id } = await params;

  try {
    // Placeholder for the actual product syncing logic.
    // In a real application, you would interact with your database,
    // call an external API, or perform whatever action is needed to sync the product.
    console.log(`Initiating sync for product: ${product_id}`);

    // Simulate a delay for the sync process
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`Successfully synced product: ${product_id}`);

    return NextResponse.json({
      message: 'Sync initiated successfully',
      productId: product_id,
    });
  } catch (error) {
    console.error(`Failed to sync product ${product_id}:`, error);
    return NextResponse.json(
      {
        message: 'Sync failed',
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
