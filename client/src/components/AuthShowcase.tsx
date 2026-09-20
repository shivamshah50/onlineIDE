export function AuthShowcase() {
  return (
    <div className="auth-showcase">
      <div className="mock-editor" aria-hidden="true">
        <div className="line">
          <span className="tok-com">// two people, one file</span>
        </div>
        <div className="line">
          <span className="tok-kw">function</span> mergeSort(arr) {'{'}
        </div>
        <div className="line">
          &nbsp;&nbsp;<span className="tok-kw">if</span> (arr.length {'<='} 1)
          <span className="tok-kw"> return</span> arr;
          <span className="cursor-tag cursor-a">priya</span>
        </div>
        <div className="line">
          &nbsp;&nbsp;<span className="tok-kw">const</span> mid ={' '}
          <span className="tok-str">Math</span>.floor(arr.length / 2);
        </div>
        <div className="line">
          &nbsp;&nbsp;<span className="tok-kw">return</span> merge(left, right);
          <span className="cursor-tag cursor-b">dev</span>
        </div>
        <div className="line">{'}'}</div>
      </div>
      <h1>Write code together, in real time</h1>
      <p className="tagline">
        One editor, live for everyone in the room, with a run button that actually works.
      </p>
    </div>
  );
}