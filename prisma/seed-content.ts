import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const blocks = [
  { key: 'hero_title', value: 'Trade predictions. Get funded.' },
  { key: 'hero_subtitle', value: 'Prove your forecasting skills on real Polymarket events. Pass the challenge, earn up to 80% of profits.' },
  { key: 'cta_text', value: 'Start your evaluation' },
  { key: 'how_it_works_1', value: JSON.stringify({ title: 'Sign up', desc: 'Create a free account and receive $10,000 in paper capital instantly.' }) },
  { key: 'how_it_works_2', value: JSON.stringify({ title: 'Trade markets', desc: 'Buy and sell YES/NO shares on real Polymarket events.' }) },
  { key: 'how_it_works_3', value: JSON.stringify({ title: 'Get funded', desc: 'Hit 10% profit target in 10+ trading days. Earn 80% of profits.' }) },
  { key: 'feature_1', value: JSON.stringify({ title: 'Real market data', desc: 'All prices sourced directly from Polymarket.' }) },
  { key: 'feature_2', value: JSON.stringify({ title: 'Paper capital', desc: '$10,000 virtual balance. Trade without financial risk.' }) },
  { key: 'feature_3', value: JSON.stringify({ title: 'Fair evaluation', desc: '10% profit target over minimum 10 trading days.' }) },
  { key: 'feature_4', value: JSON.stringify({ title: '80% profit share', desc: 'Pass the evaluation and keep 80% of all profits.' }) },
]

async function main() {
  for (const block of blocks) {
    await prisma.contentBlock.upsert({
      where: { key: block.key },
      update: { value: block.value },
      create: block,
    })
    console.log(`✓ ${block.key}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
