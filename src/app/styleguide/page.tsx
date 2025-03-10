import { Button } from '@/components/ui/button';

export default function StylePage() {
    return(
        <>
        <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold">Custom Color Test</h2>
      
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="p-4 text-white bg-pantonered rounded">Pantone Red</div>
        <div className="p-4 text-berkeleyblue bg-honeydew rounded">Honeydew</div>
        <div className="p-4 text-berkeleyblue bg-nonphotoblue rounded">Non-Photo Blue</div>
        <div className="p-4 text-white bg-cerulean rounded">Cerulean</div>
        <div className="p-4 text-white bg-berkeleyblue rounded">Berkeley Blue</div>
      </div>
      
      <h3 className="mt-6 text-xl font-bold">Color Variants</h3>
      <div className="grid grid-cols-12 gap-2">
        <div className="p-2 text-white text-center bg-pantonered rounded">default</div>
        <div className="p-2 text-white text-center bg-pantonered-50 rounded">50</div>
        <div className="p-2 text-white text-center bg-pantonered-100 rounded">100</div>
        <div className="p-2 text-white text-center bg-pantonered-200 rounded">200</div>
        <div className="p-2 text-white text-center bg-pantonered-300 rounded">300</div>
        <div className="p-2 text-white text-center bg-pantonered-400 rounded">400</div>
        <div className="p-2 text-white text-center bg-pantonered-500 rounded">500</div>
        <div className="p-2 text-white text-center bg-pantonered-600 rounded">600</div>
        <div className="p-2 text-white text-center bg-pantonered-700 rounded">700</div>
        <div className="p-2 text-white text-center bg-pantonered-800 rounded">800</div>
        <div className="p-2 text-black text-center bg-pantonered-900 rounded">900</div>
        <div className="p-2 text-white text-center bg-pantonered-950 rounded">950</div>
      </div>
      <div className="grid grid-cols-12 gap-2">
        <div className="p-2 text-white text-center bg-honeydew rounded">default</div>
        <div className="p-2 text-white text-center bg-honeydew-50 rounded">50</div>
        <div className="p-2 text-white text-center bg-honeydew-100 rounded">100</div>
        <div className="p-2 text-white text-center bg-honeydew-200 rounded">200</div>
        <div className="p-2 text-white text-center bg-honeydew-300 rounded">300</div>
        <div className="p-2 text-white text-center bg-honeydew-400 rounded">400</div>
        <div className="p-2 text-white text-center bg-honeydew-500 rounded">500</div>
        <div className="p-2 text-white text-center bg-honeydew-600 rounded">600</div>
        <div className="p-2 text-white text-center bg-honeydew-700 rounded">700</div>
        <div className="p-2 text-white text-center bg-honeydew-800 rounded">800</div>
        <div className="p-2 text-black text-center bg-honeydew-900 rounded">900</div>
        <div className="p-2 text-white text-center bg-honeydew-950 rounded">950</div>
      </div>
      <div className="grid grid-cols-12 gap-2">
        <div className="p-2 text-white text-center bg-nonphotoblue rounded">default</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-50 rounded">50</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-100 rounded">100</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-200 rounded">200</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-300 rounded">300</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-400 rounded">400</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-500 rounded">500</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-600 rounded">600</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-700 rounded">700</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-800 rounded">800</div>
        <div className="p-2 text-black text-center bg-nonphotoblue-900 rounded">900</div>
        <div className="p-2 text-white text-center bg-nonphotoblue-950 rounded">950</div>
      </div>
      <div className="grid grid-cols-12 gap-2">
        <div className="p-2 text-white text-center bg-cerulean rounded">default</div>
        <div className="p-2 text-white text-center bg-cerulean-50 rounded">50</div>
        <div className="p-2 text-white text-center bg-cerulean-100 rounded">100</div>
        <div className="p-2 text-white text-center bg-cerulean-200 rounded">200</div>
        <div className="p-2 text-white text-center bg-cerulean-300 rounded">300</div>
        <div className="p-2 text-white text-center bg-cerulean-400 rounded">400</div>
        <div className="p-2 text-white text-center bg-cerulean-500 rounded">500</div>
        <div className="p-2 text-white text-center bg-cerulean-600 rounded">600</div>
        <div className="p-2 text-white text-center bg-cerulean-700 rounded">700</div>
        <div className="p-2 text-white text-center bg-cerulean-800 rounded">800</div>
        <div className="p-2 text-black text-center bg-cerulean-900 rounded">900</div>
        <div className="p-2 text-white text-center bg-cerulean-950 rounded">950</div>
      </div>
      <div className="grid grid-cols-12 gap-2">
        <div className="p-2 text-white text-center bg-berkeleyblue rounded">default</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-50 rounded">50</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-100 rounded">100</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-200 rounded">200</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-300 rounded">300</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-400 rounded">400</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-500 rounded">500</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-600 rounded">600</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-700 rounded">700</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-800 rounded">800</div>
        <div className="p-2 text-black text-center bg-berkeleyblue-900 rounded">900</div>
        <div className="p-2 text-white text-center bg-berkeleyblue-950 rounded">950</div>
      </div>
      <div className="grid grid-cols-12 gap-2">
        <div className="p-2 text-white text-center bg-slate rounded">default</div>
        <div className="p-2 text-white text-center bg-slate-50 rounded">50</div>
        <div className="p-2 text-white text-center bg-slate-100 rounded">100</div>
        <div className="p-2 text-white text-center bg-slate-200 rounded">200</div>
        <div className="p-2 text-white text-center bg-slate-300 rounded">300</div>
        <div className="p-2 text-white text-center bg-slate-400 rounded">400</div>
        <div className="p-2 text-white text-center bg-slate-500 rounded">500</div>
        <div className="p-2 text-white text-center bg-slate-600 rounded">600</div>
        <div className="p-2 text-white text-center bg-slate-700 rounded">700</div>
        <div className="p-2 text-white text-center bg-slate-800 rounded">800</div>
        <div className="p-2 text-black text-center bg-slate-900 rounded">900</div>
        <div className="p-2 text-black text-center bg-slate-950 rounded">950</div>
      </div>
      
      {/* Test text colors */}
      <h3 className="mt-6 text-xl font-bold">Text Colors</h3>
      <p className="text-pantonered">Text in Pantone Red</p>
      <p className="text-cerulean">Text in Cerulean</p>
      <p className="text-berkeleyblue">Text in Berkeley Blue</p>
      <p className='text-slate-500'>Text in Slate</p>


    <h3 className="mt-6 text-xl font-bold">Button Variants</h3> 
    <div className="grid grid-cols-6 gap-2">
      <Button>Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>

    <h3 className="mt-6 text-xl font-bold">Headlines</h3> 
    <h1 className='text-6xl font-light text-berkeleyblue'>Rate <strong className='font-medium'>David Clark&#39;s</strong> contribution right now</h1>
    <h1 className='text-6xl font-light text-berkeleyblue'>What should David Clark keep doing?</h1>
    <br/>
    <h2 className='text-4xl font-light text-berkeleyblue'>Rate <strong className='font-medium'>David Clark&#39;s</strong> contribution right now</h2>
    <h2 className='text-4xl font-light text-berkeleyblue'>What should David Clark keep doing?</h2>
    <br/>
    <h3 className='text-2xl font-light text-berkeleyblue'>Rate <strong className='font-medium'>David Clark&#39;s</strong> contribution right now</h3>
    <h3 className='text-2xl font-light text-berkeleyblue'>What should David Clark keep doing?</h3>
    <br/>
    <h4 className='text-lg font-light text-berkeleyblue'>Rate <strong className='font-medium'>David Clark&#39;s</strong> contribution right now</h4>
    <h4 className='text-lg font-light text-berkeleyblue'>What should David Clark keep doing?</h4>
    <br/>
    <p className='text-slate-500 text-base font-light'>
      I believe that Danni should formulate her own opinions on approaches to problems and challenge solutions that are proposed by his peers more. This will allow Danni to influence project directions more as a leader. I believe that Danni should formulate her own opinions on approaches to problems and challenge solutions that are proposed by his peers more. This will allow Danni to influence project directions more as a leader
    </p>
    <br/>
    <p className='text-slate-500'>
      I believe that Danni should formulate her own opinions on approaches to problems and challenge solutions that are proposed by his peers more. This will allow Danni to influence project directions more as a leader. I believe that Danni should formulate her own opinions on approaches to problems and challenge solutions that are proposed by his peers more. This will allow Danni to influence project directions more as a leader
    </p>
    </div>
    </>
    );
}