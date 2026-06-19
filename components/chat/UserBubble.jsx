export default function UserBubble({ text, time }) {
  return (
    <div className="flex gap-2.5 justify-end">
      <div className="max-w-[88%]">
        <div className="rounded-2xl rounded-tr-md bg-wblue-500 text-white px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm">
          {text}
        </div>
        <div className="text-[10.5px] text-wsub mt-1 text-right pr-1">{time}</div>
      </div>
      <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-wblue-400 to-wblue-600 text-white grid place-items-center text-[11px] font-bold shadow-sm">
        YS
      </div>
    </div>
  );
}
