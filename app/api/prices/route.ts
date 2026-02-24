export async function GET() {
  try {
    const ids = "tether,usd-coin,dai,ethena-usde,paypal-usd,first-digital-usd,ripple-usd,true-usd";
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );

    const data = await response.json();

    const prices = {
      usdt: data["tether"]?.usd ?? 1.0,
      usdc: data["usd-coin"]?.usd ?? 1.0,
      usds: data["dai"]?.usd ?? 1.0,
      ethena: data["ethena-usde"]?.usd ?? 1.0,
      pyusd: data["paypal-usd"]?.usd ?? 1.0,
      fdusd: data["first-digital-usd"]?.usd ?? 1.0,
      rlusd: data["ripple-usd"]?.usd ?? 1.0,
      tusd: data["true-usd"]?.usd ?? 1.0,
    };

    return Response.json({ prices });
  } catch (error) {
    return Response.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}